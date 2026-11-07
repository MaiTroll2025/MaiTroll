-- Mai Dont Know Game — question bank + seed + auto-create first round on match start.
-- Builds on 20291108000003_mai_dont_know_game.sql

create table if not exists public.mai_dk_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  prompt text not null,
  options jsonb not null,
  correct_index int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.mai_dk_questions enable row level security;
revoke all on public.mai_dk_questions from anon, authenticated;
grant select on public.mai_dk_questions to authenticated;
create policy "Questions are viewable by authenticated" on public.mai_dk_questions for select to authenticated using (true);

-- MAI DON'T KNOW: 280 additional curated four-choice trivia questions.
-- Works with the user's existing public.mai_dk_questions structure.
-- Initial 21 questions + 280 = 301 total if all initial questions are present.
-- Safe to rerun: question text is deduplicated case-insensitively.
-- These questions are stable factual trivia, not daily or time-sensitive facts.
-- IMPORTANT: This is the seed-and-history portion of no-repeat implementation.
-- The game start and each next-round creator MUST call the claim function below
-- with the complete AUTHORIZED active-player UUID roster in the same transaction.
-- If you don't wire that call, repetition is NOT prevented.

begin;

-- Fail safely if pre-existing duplicate prompts would make the uniqueness index fail.
do $$
begin
  if exists (
    select 1 from public.mai_dk_questions
    group by lower(btrim(prompt))
    having count(*) > 1
  ) then
    raise exception 'mai_dk_questions already has duplicate prompts. Resolve duplicates safely before applying this migration.';
  end if;
end $$;

create unique index if not exists mai_dk_questions_unique_prompt_ci
  on public.mai_dk_questions (lower(btrim(prompt)));

-- A user may be assigned a question only once across all rooms and all matches.
create table if not exists public.mai_dk_question_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.mai_dk_questions(id) on delete restrict,
  first_room_id uuid,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists mai_dk_question_history_user_seen_idx
  on public.mai_dk_question_history (user_id, first_seen_at desc);

alter table public.mai_dk_question_history enable row level security;
revoke all on public.mai_dk_question_history from public, anon, authenticated;
grant select on public.mai_dk_question_history to authenticated;
drop policy if exists "Players view their own question history" on public.mai_dk_question_history;
create policy "Players view their own question history"
  on public.mai_dk_question_history for select to authenticated
  using (user_id = (select auth.uid()));

-- Track question identity in rounds so restarts / audits don't depend on text matching.
alter table public.mai_dk_game_rounds
  add column if not exists question_id uuid references public.mai_dk_questions(id);
create index if not exists mai_dk_game_rounds_question_id_idx
  on public.mai_dk_game_rounds (question_id);

-- Do not expose correct_index in the full question bank to ordinary players.
-- The existing "Questions are viewable by authenticated" policy and SELECT grant
-- currently allow clients to download the answers to every question.
-- Integrate a safe player-facing CURRENT ROUND read endpoint returning only
-- prompt, options, category and deadline, then enable these statements:
-- drop policy if exists "Questions are viewable by authenticated" on public.mai_dk_questions;
-- revoke select on public.mai_dk_questions from authenticated;

-- Internal trusted helper. Caller must supply complete REAL participants from
-- the existing room roster; never accept the IDs directly from a client.
-- Holds transaction-scoped advisory locks on all player IDs in stable order
-- so simultaneous games for the same player cannot repeat a question.
-- Fails closed when there is no question unseen by EVERY participant.
create or replace function public.mai_dk_claim_unseen_question(
  p_room_id uuid,
  p_player_ids uuid[]
) returns public.mai_dk_questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player_ids uuid[];
  v_player_id uuid;
  v_question public.mai_dk_questions%rowtype;
begin
  select array_agg(distinct p.player_id order by p.player_id) into v_player_ids
  from unnest(p_player_ids) as p(player_id)
  where p.player_id is not null;

  if coalesce(array_length(v_player_ids, 1), 0) = 0 then
    raise exception 'Cannot choose a question: authorized player roster is empty.';
  end if;

  foreach v_player_id in array v_player_ids loop
    perform pg_advisory_xact_lock(hashtextextended(v_player_id::text, 510973));
  end loop;

  select q.* into v_question
  from public.mai_dk_questions q
  where q.is_active = true
    and not exists (
      select 1 from public.mai_dk_question_history h
      where h.question_id = q.id and h.user_id = any(v_player_ids)
    )
  order by random()
  limit 1;

  if not found then
    raise exception 'No unseen questions remain for this group. Add more questions; do not repeat old questions.';
  end if;

  insert into public.mai_dk_question_history (user_id, question_id, first_room_id)
  select p.player_id, v_question.id, p_room_id
  from unnest(v_player_ids) as p(player_id);

  return v_question;
end;
$$;

revoke all on function public.mai_dk_claim_unseen_question(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.mai_dk_claim_unseen_question(uuid, uuid[]) to service_role;

-- 280 more questions. The original 21 are intentionally not reinserted.
with source(category, prompt, options_text, correct_index) as (
  values
    ('Geography', 'What is the capital of Portugal?', '["Coimbra", "Porto", "Madrid", "Lisbon"]', 3),
    ('Geography', 'What is the capital of Norway?', '["Oslo", "Helsinki", "Stockholm", "Bergen"]', 0),
    ('Geography', 'Which river flows through Cairo?', '["Tigris", "Danube", "Nile", "Amazon"]', 2),
    ('Geography', 'Which desert covers much of northern Africa?', '["Kalahari", "Gobi", "Atacama", "Sahara"]', 3),
    ('Geography', 'Which mountain range separates much of Europe from Asia?', '["Rockies", "Andes", "Alps", "Ural Mountains"]', 3),
    ('Geography', 'Which country is home to Machu Picchu?', '["Chile", "Peru", "Bolivia", "Ecuador"]', 1),
    ('Geography', 'What is the capital of Kenya?', '["Lagos", "Mombasa", "Nairobi", "Kampala"]', 2),
    ('Geography', 'Which sea lies between Europe and Africa?', '["Caspian Sea", "Baltic Sea", "Mediterranean Sea", "Red Sea"]', 2),
    ('Geography', 'Which country contains the city of Krakow?', '["Hungary", "Czechia", "Poland", "Austria"]', 2),
    ('Geography', 'Which continent contains the country of Suriname?', '["Asia", "Africa", "South America", "Europe"]', 2),
    ('Geography', 'What is the capital of South Korea?', '["Busan", "Incheon", "Seoul", "Daegu"]', 2),
    ('Geography', 'Which river runs through London?', '["Thames", "Seine", "Rhine", "Po"]', 0),
    ('Geography', 'What is the capital of Argentina?', '["Buenos Aires", "Montevideo", "Santiago", "Cordoba"]', 0),
    ('Geography', 'Which country is shaped like a boot on many maps?', '["Italy", "Greece", "Croatia", "Portugal"]', 0),
    ('Geography', 'Which island country lies southeast of India?', '["Madagascar", "Cuba", "Sri Lanka", "Iceland"]', 2),
    ('Geography', 'What is the capital of Thailand?', '["Hanoi", "Bangkok", "Chiang Mai", "Phuket"]', 1),
    ('Geography', 'Which strait separates Spain from Morocco?', '["Bering Strait", "Strait of Gibraltar", "Strait of Hormuz", "Bosporus"]', 1),
    ('Geography', 'Which country has the city of Marrakech?', '["Algeria", "Morocco", "Tunisia", "Egypt"]', 1),
    ('Geography', 'What is the capital of New Zealand?', '["Hamilton", "Christchurch", "Auckland", "Wellington"]', 3),
    ('Geography', 'Which country has the Great Barrier Reef off its coast?', '["Fiji", "Indonesia", "Philippines", "Australia"]', 3),
    ('Earth & Nature', 'What type of rock forms when magma cools?', '["Sedimentary", "Metamorphic", "Fossil", "Igneous"]', 3),
    ('Earth & Nature', 'What instrument measures earthquake vibrations?', '["Barometer", "Seismometer", "Thermometer", "Hygrometer"]', 1),
    ('Earth & Nature', 'What is the outermost solid layer of Earth called?', '["Inner core", "Mantle", "Outer core", "Crust"]', 3),
    ('Earth & Nature', 'What is the process of water vapor turning into liquid called?', '["Melting", "Condensation", "Evaporation", "Sublimation"]', 1),
    ('Earth & Nature', 'What natural force mainly causes ocean tides?', '["Moon''s gravity", "Volcanic heat", "Earth''s magnetism", "Wind"]', 0),
    ('Earth & Nature', 'What is the name for molten rock beneath Earth''s surface?', '["Lava", "Magma", "Basalt", "Ash"]', 1),
    ('Earth & Nature', 'What cloud type often produces thunderstorms?', '["Stratus", "Cirrus", "Altocumulus", "Cumulonimbus"]', 3),
    ('Earth & Nature', 'Which scale describes the acidity or alkalinity of a solution?', '["pH scale", "Mohs scale", "Richter scale", "Beaufort scale"]', 0),
    ('Earth & Nature', 'Which part of the water cycle moves liquid water into the atmosphere?', '["Precipitation", "Infiltration", "Evaporation", "Runoff"]', 2),
    ('Earth & Nature', 'Which type of coral reef is separated from the shoreline by a lagoon?', '["Tide pool", "Barrier reef", "Sand dune", "River delta"]', 1),
    ('Earth & Nature', 'What does a barometer measure?', '["Wind direction", "Rainfall", "Atmospheric pressure", "Humidity"]', 2),
    ('Earth & Nature', 'Which soil layer is commonly rich in humus?', '["Bedrock", "Topsoil", "Parent rock", "Mantle"]', 1),
    ('Earth & Nature', 'What process wears rock away through wind or water?', '["Combustion", "Pollination", "Fusion", "Erosion"]', 3),
    ('Earth & Nature', 'What is the point on Earth''s surface directly above an earthquake focus?', '["Equator", "Crater", "Meridian", "Epicenter"]', 3),
    ('Earth & Nature', 'Which gas makes up most of Earth''s atmosphere?', '["Nitrogen", "Carbon dioxide", "Oxygen", "Argon"]', 0),
    ('Earth & Nature', 'What kind of boundary occurs where tectonic plates move apart?', '["Convergent boundary", "Divergent boundary", "Transform boundary", "Stationary boundary"]', 1),
    ('Earth & Nature', 'What is a large mass of moving ice on land called?', '["Hailstone", "Iceberg", "Permafrost", "Glacier"]', 3),
    ('Earth & Nature', 'Which ocean current helps warm western Europe?', '["California Current", "Gulf Stream", "Humboldt Current", "Oyashio Current"]', 1),
    ('Earth & Nature', 'What is the name for a scientist who studies weather?', '["Astronomer", "Botanist", "Meteorologist", "Geologist"]', 2),
    ('Earth & Nature', 'What mineral is ranked 10 on the Mohs hardness scale?', '["Talc", "Calcite", "Diamond", "Quartz"]', 2),
    ('Biology', 'What organ pumps blood through the human body?', '["Lung", "Kidney", "Liver", "Heart"]', 3),
    ('Biology', 'What molecule carries genetic instructions in most organisms?', '["ATP", "DNA", "Collagen", "Glucose"]', 1),
    ('Biology', 'What is the basic unit of life?', '["Atom", "Organ", "Tissue", "Cell"]', 3),
    ('Biology', 'What process allows plants to make sugars using sunlight?', '["Fermentation", "Digestion", "Photosynthesis", "Respiration"]', 2),
    ('Biology', 'Which organelle is often called the powerhouse of the cell?', '["Ribosome", "Nucleus", "Mitochondrion", "Vacuole"]', 2),
    ('Biology', 'What type of animal is a frog?', '["Reptile", "Mammal", "Amphibian", "Bird"]', 2),
    ('Biology', 'What part of a flower produces pollen?', '["Petal", "Stigma", "Anther", "Sepal"]', 2),
    ('Biology', 'What is the largest organ of the human body?', '["Brain", "Heart", "Liver", "Skin"]', 3),
    ('Biology', 'Which cells transport oxygen in human blood?', '["Neurons", "White blood cells", "Platelets", "Red blood cells"]', 3),
    ('Biology', 'What is the biological term for an animal that eats plants?', '["Herbivore", "Omnivore", "Detritivore", "Carnivore"]', 0),
    ('Biology', 'What process creates two genetically identical daughter cells?', '["Mutation", "Meiosis", "Mitosis", "Fertilization"]', 2),
    ('Biology', 'Which kingdom includes mushrooms?', '["Protista", "Animalia", "Plantae", "Fungi"]', 3),
    ('Biology', 'What do bees commonly collect from flowers to make honey?', '["Chlorophyll", "Nectar", "Sapwood", "Pollen tubes"]', 1),
    ('Biology', 'Which human body system includes the brain and spinal cord?', '["Skeletal system", "Nervous system", "Digestive system", "Endocrine system"]', 1),
    ('Biology', 'What is a baby butterfly called before it becomes a pupa?', '["Caterpillar", "Tadpole", "Fry", "Nymph"]', 0),
    ('Biology', 'Which pigment gives most leaves their green color?', '["Keratin", "Chlorophyll", "Melanin", "Hemoglobin"]', 1),
    ('Biology', 'What does an entomologist study?', '["Fish", "Birds", "Insects", "Mosses"]', 2),
    ('Biology', 'Which bone protects the human brain?', '["Femur", "Skull", "Rib", "Clavicle"]', 1),
    ('Biology', 'Which blood component helps form clots?', '["Plasma proteins only", "Neurons", "Platelets", "Red cells"]', 2),
    ('Biology', 'What is the scientific name for a species'' two-part naming system?', '["Osmosis", "Taxidermy", "Binomial nomenclature", "Photosynthesis"]', 2),
    ('Chemistry', 'What is the chemical symbol for gold?', '["Ag", "Fe", "Au", "Cu"]', 2),
    ('Chemistry', 'What is the chemical symbol for sodium?', '["Na", "So", "S", "Sn"]', 0),
    ('Chemistry', 'What is the atomic number of carbon?', '["6", "14", "12", "8"]', 0),
    ('Chemistry', 'Which particle in an atom has a negative charge?', '["Electron", "Proton", "Neutron", "Nucleus"]', 0),
    ('Chemistry', 'Which element has the symbol He?', '["Holmium", "Hafnium", "Helium", "Hydrogen"]', 2),
    ('Chemistry', 'What is the common name for sodium chloride?', '["Vinegar", "Baking soda", "Table salt", "Sugar"]', 2),
    ('Chemistry', 'Which gas is released when vinegar reacts with baking soda?', '["Carbon dioxide", "Oxygen", "Nitrogen", "Helium"]', 0),
    ('Chemistry', 'What is the chemical symbol for iron?', '["Ir", "Fe", "In", "I"]', 1),
    ('Chemistry', 'What is the pH of pure water at 25 degrees Celsius?', '["1", "10", "14", "7"]', 3),
    ('Chemistry', 'What type of chemical bond involves shared electrons?', '["Ionic", "Hydrogen bond", "Covalent", "Metallic"]', 2),
    ('Chemistry', 'Which element is a liquid at room temperature?', '["Aluminum", "Sulfur", "Mercury", "Iron"]', 2),
    ('Chemistry', 'What is the chemical formula for methane?', '["NH3", "CO2", "CH4", "H2O"]', 2),
    ('Chemistry', 'What does the symbol O represent on the periodic table?', '["Oxide", "Osmium", "Oxygen", "Gold"]', 2),
    ('Chemistry', 'Which part of an atom contains protons and neutrons?', '["Orbital", "Nucleus", "Valence shell", "Electron cloud"]', 1),
    ('Chemistry', 'What type of reaction absorbs heat from its surroundings?', '["Nuclear fission", "Neutralization", "Exothermic", "Endothermic"]', 3),
    ('Chemistry', 'What is the chemical symbol for potassium?', '["K", "P", "Pt", "Po"]', 0),
    ('Chemistry', 'Which element has atomic number 1?', '["Hydrogen", "Oxygen", "Helium", "Lithium"]', 0),
    ('Chemistry', 'What is the chemical formula for carbon dioxide?', '["CO", "C2O", "O2", "CO2"]', 3),
    ('Chemistry', 'What kind of substance speeds up a reaction without being consumed?', '["Catalyst", "Solvent", "Precipitate", "Reactant"]', 0),
    ('Chemistry', 'What is the chemical symbol for silver?', '["Si", "Au", "Ag", "S"]', 2),
    ('Physics', 'What is the SI unit of force?', '["Newton", "Pascal", "Joule", "Watt"]', 0),
    ('Physics', 'What is the SI unit of electric current?', '["Ampere", "Watt", "Ohm", "Volt"]', 0),
    ('Physics', 'What quantity is measured in hertz?', '["Force", "Pressure", "Frequency", "Energy"]', 2),
    ('Physics', 'What type of energy does a moving object possess?', '["Chemical energy", "Kinetic energy", "Potential energy", "Nuclear energy"]', 1),
    ('Physics', 'What is the speed of light in vacuum approximately?', '["300000 kilometers per second", "300 kilometers per second", "30000 kilometers per second", "3000000 kilometers per second"]', 0),
    ('Physics', 'What force opposes sliding motion between surfaces?', '["Tension", "Buoyancy", "Friction", "Magnetism"]', 2),
    ('Physics', 'What does a convex lens typically do to parallel light rays?', '["Makes them travel backward", "Turns them into sound", "Blocks them", "Converges them"]', 3),
    ('Physics', 'Which simple machine is a seesaw?', '["Wedge", "Pulley", "Lever", "Screw"]', 2),
    ('Physics', 'What is the SI unit of energy?', '["Tesla", "Joule", "Watt", "Newton"]', 1),
    ('Physics', 'Which law describes the relationship F = ma?', '["Ohm''s law", "Kepler''s third law", "Boyle''s law", "Newton''s second law"]', 3),
    ('Physics', 'What quantity does a thermometer measure?', '["Temperature", "Velocity", "Mass", "Pressure"]', 0),
    ('Physics', 'Which wave type requires a medium to travel?', '["Sound wave", "Radio wave", "Light wave", "X-ray"]', 0),
    ('Physics', 'What is the SI unit of electrical resistance?', '["Volt", "Ohm", "Ampere", "Farad"]', 1),
    ('Physics', 'What does a prism commonly separate white light into?', '["Sound frequencies", "Colors of the spectrum", "Electric charges", "Magnetic poles"]', 1),
    ('Physics', 'What phenomenon bends light as it passes between materials?', '["Convection", "Refraction", "Conduction", "Diffusion"]', 1),
    ('Physics', 'What is the downward acceleration near Earth''s surface approximately?', '["0.98 meters per second squared", "1 meter per second squared", "9.8 meters per second squared", "98 meters per second squared"]', 2),
    ('Physics', 'Which quantity equals mass times velocity?', '["Power", "Density", "Momentum", "Pressure"]', 2),
    ('Physics', 'What is the SI unit of power?', '["Newton", "Kelvin", "Watt", "Joule"]', 2),
    ('Physics', 'What is the name for the highest point of a wave?', '["Trough", "Node", "Focal point", "Crest"]', 3),
    ('Physics', 'Which scientist developed the theory of general relativity?', '["Niels Bohr", "Isaac Newton", "Albert Einstein", "Michael Faraday"]', 2),
    ('Space', 'Which planet is closest to the Sun?', '["Mercury", "Venus", "Earth", "Mars"]', 0),
    ('Space', 'Which planet is famous for its prominent ring system?', '["Mercury", "Mars", "Venus", "Saturn"]', 3),
    ('Space', 'What is Earth''s natural satellite called?', '["Phobos", "Europa", "Titan", "Moon"]', 3),
    ('Space', 'Which galaxy contains our Solar System?', '["Milky Way", "Triangulum", "Whirlpool", "Andromeda"]', 0),
    ('Space', 'What is the name of the Sun''s outer atmosphere?', '["Corona", "Core", "Photosphere", "Chromosphere"]', 0),
    ('Space', 'Which planet has the Great Red Spot?', '["Neptune", "Saturn", "Jupiter", "Uranus"]', 2),
    ('Space', 'What is a rocky object orbiting the Sun mostly between Mars and Jupiter called?', '["Comet tail", "Asteroid", "Pulsar", "Nebula"]', 1),
    ('Space', 'What is the closest star to Earth?', '["Sirius", "Polaris", "Sun", "Betelgeuse"]', 2),
    ('Space', 'What is the name of the first artificial satellite launched into orbit?', '["Vostok 1", "Explorer 1", "Sputnik 1", "Apollo 11"]', 2),
    ('Space', 'Which moon of Saturn has a thick atmosphere?', '["Titan", "Europa", "Deimos", "Phobos"]', 0),
    ('Space', 'What do astronomers call an exploding star?', '["Asteroid", "Meteorite", "Quasar", "Supernova"]', 3),
    ('Space', 'What is the boundary beyond which light cannot escape a black hole?', '["Heliopause", "Asteroid belt", "Event horizon", "Oort cloud"]', 2),
    ('Space', 'Which planet rotates on its side relative to its orbit?', '["Mercury", "Mars", "Jupiter", "Uranus"]', 3),
    ('Space', 'What is the term for a planet orbiting a star outside our Solar System?', '["Meteoroid", "Exoplanet", "Dwarf galaxy", "Comet"]', 1),
    ('Space', 'What is the name of the large cloud of gas and dust where stars may form?', '["Orbit", "Magnetosphere", "Crater", "Nebula"]', 3),
    ('Space', 'Which planet is often called Earth''s twin because of its similar size?', '["Mercury", "Jupiter", "Venus", "Neptune"]', 2),
    ('Space', 'Which spacecraft carried the first humans to land on the Moon?', '["Apollo 11", "Apollo 8", "Gemini 4", "Voyager 1"]', 0),
    ('Space', 'Which planet has the tallest known volcano in the Solar System?', '["Jupiter", "Venus", "Earth", "Mars"]', 3),
    ('Space', 'What is the point in an orbit farthest from Earth called?', '["Perigee", "Equinox", "Solstice", "Apogee"]', 3),
    ('Space', 'Which dwarf planet was once classified as the ninth planet?', '["Ceres", "Eris", "Haumea", "Pluto"]', 3),
    ('History', 'In which year was the United States Declaration of Independence adopted?', '["1776", "1492", "1865", "1812"]', 0),
    ('History', 'Which civilization built the pyramids at Giza?', '["Aztecs", "Vikings", "Ancient Greeks", "Ancient Egyptians"]', 3),
    ('History', 'Which Roman state appointed Julius Caesar as dictator?', '["Roman Republic", "Ottoman Empire", "Mongol Empire", "Persian Empire"]', 0),
    ('History', 'Who was the first person to walk on the Moon?', '["Buzz Aldrin", "Neil Armstrong", "John Glenn", "Yuri Gagarin"]', 1),
    ('History', 'What year did the Berlin Wall fall?', '["1999", "1989", "1969", "1979"]', 1),
    ('History', 'Which document was signed by King John of England in 1215?', '["Bill of Rights", "Declaration of Independence", "Magna Carta", "Treaty of Versailles"]', 2),
    ('History', 'What city was the capital of the Byzantine Empire?', '["Alexandria", "Constantinople", "Athens", "Rome"]', 1),
    ('History', 'Who led a nonviolent independence movement in India?', '["Simón Bolívar", "Mahatma Gandhi", "Napoleon Bonaparte", "Winston Churchill"]', 1),
    ('History', 'Which war ended with the Treaty of Versailles in 1919?', '["World War I", "Seven Years'' War", "Crimean War", "World War II"]', 0),
    ('History', 'Which dynasty built much of the present-day Great Wall of China?', '["Tang dynasty", "Han dynasty", "Qin dynasty", "Ming dynasty"]', 3),
    ('History', 'In which year did the Titanic sink?', '["1920", "1912", "1931", "1905"]', 1),
    ('History', 'Which American president issued the Emancipation Proclamation?', '["Theodore Roosevelt", "Abraham Lincoln", "Ulysses S. Grant", "George Washington"]', 1),
    ('History', 'Which ancient city was buried by Mount Vesuvius in AD 79?', '["Carthage", "Pompeii", "Troy", "Sparta"]', 1),
    ('History', 'Who was the first emperor of China?', '["Kublai Khan", "Confucius", "Qin Shi Huang", "Sun Yat-sen"]', 2),
    ('History', 'What was the name of the ship that carried the Pilgrims to Plymouth in 1620?', '["Beagle", "Santa Maria", "Mayflower", "Endeavour"]', 2),
    ('History', 'Which civilization developed cuneiform writing?', '["Maya", "Inca", "Romans", "Sumerians"]', 3),
    ('History', 'What year did the Soviet Union formally dissolve?', '["1975", "2001", "1985", "1991"]', 3),
    ('History', 'Which explorer''s expedition completed the first circumnavigation of Earth?', '["Vasco da Gama''s expedition", "Christopher Columbus''s expedition", "James Cook''s first voyage", "Ferdinand Magellan''s expedition"]', 3),
    ('History', 'Which queen ruled England during the defeat of the Spanish Armada?', '["Victoria", "Anne", "Mary I", "Elizabeth I"]', 3),
    ('History', 'What was the name of the trade routes linking Asia, Europe, and Africa?', '["Appian Way", "Route 66", "Silk Roads", "Pan-American Highway"]', 2),
    ('Literature', 'Who wrote Pride and Prejudice?', '["Jane Austen", "George Eliot", "Mary Shelley", "Charlotte Brontë"]', 0),
    ('Literature', 'Who created the detective Sherlock Holmes?', '["Wilkie Collins", "Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe"]', 2),
    ('Literature', 'Which novel begins with the line Call me Ishmael?', '["Dracula", "Moby-Dick", "The Great Gatsby", "Treasure Island"]', 1),
    ('Literature', 'Who wrote 1984?', '["Aldous Huxley", "H. G. Wells", "Ray Bradbury", "George Orwell"]', 3),
    ('Literature', 'Who wrote The Hobbit?', '["C. S. Lewis", "J. K. Rowling", "J. R. R. Tolkien", "Philip Pullman"]', 2),
    ('Literature', 'In Greek myth, who is the hero of the Odyssey?', '["Perseus", "Odysseus", "Achilles", "Hercules"]', 1),
    ('Literature', 'Who wrote Frankenstein?', '["Bram Stoker", "Mary Shelley", "Emily Brontë", "Virginia Woolf"]', 1),
    ('Literature', 'Which poet wrote The Raven?', '["Walt Whitman", "John Keats", "Edgar Allan Poe", "Robert Frost"]', 2),
    ('Literature', 'What is a fourteen-line poem often called?', '["Limerick", "Ballad", "Haiku", "Sonnet"]', 3),
    ('Literature', 'Who wrote The Great Gatsby?', '["John Steinbeck", "Ernest Hemingway", "F. Scott Fitzgerald", "William Faulkner"]', 2),
    ('Literature', 'What is the fictional school in the Harry Potter series?', '["Middle-earth", "Narnia", "Neverland", "Hogwarts"]', 3),
    ('Literature', 'Who wrote Don Quixote?', '["Pablo Neruda", "Gabriel García Márquez", "Jorge Luis Borges", "Miguel de Cervantes"]', 3),
    ('Literature', 'Which book features the character Atticus Finch?', '["Lord of the Flies", "To Kill a Mockingbird", "Of Mice and Men", "The Catcher in the Rye"]', 1),
    ('Literature', 'What is the term for a comparison using like or as?', '["Simile", "Alliteration", "Metaphor", "Onomatopoeia"]', 0),
    ('Literature', 'Who wrote A Christmas Carol?', '["Mark Twain", "Oscar Wilde", "Charles Dickens", "Herman Melville"]', 2),
    ('Literature', 'Which epic poem tells of the Trojan War and Achilles?', '["Iliad", "Beowulf", "Aeneid", "Odyssey"]', 0),
    ('Literature', 'Who wrote The Handmaid''s Tale?', '["Alice Walker", "Ursula K. Le Guin", "Margaret Atwood", "Toni Morrison"]', 2),
    ('Literature', 'Who wrote The Adventures of Tom Sawyer?', '["Jack London", "Nathaniel Hawthorne", "Mark Twain", "Louisa May Alcott"]', 2),
    ('Literature', 'Which novel features a pig named Napoleon?', '["The Wind in the Willows", "Charlotte''s Web", "Watership Down", "Animal Farm"]', 3),
    ('Literature', 'Who wrote The Little Prince?', '["Antoine de Saint-Exupéry", "Albert Camus", "Victor Hugo", "Jules Verne"]', 0),
    ('Art', 'Which artist painted The Starry Night?', '["Vincent van Gogh", "Claude Monet", "Rembrandt", "Salvador Dalí"]', 0),
    ('Art', 'Which artist sculpted the marble David now displayed at Florence''s Accademia?', '["Donatello", "Bernini", "Michelangelo", "Rodin"]', 2),
    ('Art', 'In painting, what are red, blue, and yellow traditionally called?', '["Primary colors", "Complementary colors", "Neutral colors", "Secondary colors"]', 0),
    ('Art', 'Which art movement is closely associated with Salvador Dalí?', '["Impressionism", "Surrealism", "Cubism", "Fauvism"]', 1),
    ('Art', 'Who painted The Persistence of Memory?', '["Salvador Dalí", "Pablo Picasso", "Edvard Munch", "Henri Matisse"]', 0),
    ('Art', 'What technique uses tiny dots of color to create an image?', '["Pointillism", "Collage", "Fresco", "Etching"]', 0),
    ('Art', 'Which painter created Guernica?', '["Paul Cézanne", "Claude Monet", "Pablo Picasso", "Gustav Klimt"]', 2),
    ('Art', 'What is a painting made on wet plaster called?', '["Mosaic", "Fresco", "Lithograph", "Woodcut"]', 1),
    ('Art', 'Which artist is famous for Campbell''s Soup Cans?', '["Georgia O''Keeffe", "Jackson Pollock", "Andy Warhol", "Roy Lichtenstein"]', 2),
    ('Art', 'Who painted The Scream?', '["Vincent van Gogh", "Francisco Goya", "Edvard Munch", "René Magritte"]', 2),
    ('Art', 'Which Japanese artist created The Great Wave off Kanagawa?', '["Hokusai", "Yayoi Kusama", "Hiroshige", "Takashi Murakami"]', 0),
    ('Art', 'What is the art of decorative handwriting called?', '["Photography", "Cartography", "Typography", "Calligraphy"]', 3),
    ('Art', 'Which museum in Paris houses the Mona Lisa?', '["Louvre Museum", "Prado Museum", "Musée d''Orsay", "Uffizi Gallery"]', 0),
    ('Art', 'Who painted the ceiling of the Sistine Chapel?', '["Michelangelo", "Leonardo da Vinci", "Raphael", "Titian"]', 0),
    ('Art', 'Which artist is associated with drip painting?', '["Jackson Pollock", "Johannes Vermeer", "Edward Hopper", "Paul Klee"]', 0),
    ('Art', 'What is a sculpture created by assembling found objects called?', '["Fresco", "Etching", "Assemblage", "Engraving"]', 2),
    ('Art', 'Which Dutch artist painted Girl with a Pearl Earring?', '["Frans Hals", "Rembrandt", "Johannes Vermeer", "Piet Mondrian"]', 2),
    ('Art', 'Which movement is known for depicting subjects using geometric fragments?', '["Cubism", "Realism", "Romanticism", "Baroque"]', 0),
    ('Art', 'What is a collection of small colored pieces forming an image called?', '["Watercolor", "Mosaic", "Sketch", "Pastel"]', 1),
    ('Art', 'Who designed the iconic glass pyramid at the Louvre?', '["Zaha Hadid", "Le Corbusier", "I. M. Pei", "Frank Lloyd Wright"]', 2),
    ('Music', 'Which instrument is played using a bow and has four strings?', '["Flute", "Trumpet", "Piano", "Violin"]', 3),
    ('Music', 'Which musical symbol raises a note by one semitone?', '["Flat", "Sharp", "Rest", "Natural"]', 1),
    ('Music', 'How many beats does a quarter note usually receive in 4/4 time?', '["Three", "Two", "One", "Four"]', 2),
    ('Music', 'Which composer wrote the Fifth Symphony with the famous four-note opening?', '["Frédéric Chopin", "Johann Sebastian Bach", "Wolfgang Amadeus Mozart", "Ludwig van Beethoven"]', 3),
    ('Music', 'What is the musical term for gradually getting louder?', '["Diminuendo", "Staccato", "Legato", "Crescendo"]', 3),
    ('Music', 'Which instrument family includes the trumpet?', '["Woodwind", "String", "Percussion", "Brass"]', 3),
    ('Music', 'Which composer wrote The Four Seasons?', '["Joseph Haydn", "Claude Debussy", "Gustav Mahler", "Antonio Vivaldi"]', 3),
    ('Music', 'What does BPM stand for in music?', '["Beats per minute", "Bass pitch measurement", "Bars per melody", "Beats per measure"]', 0),
    ('Music', 'Which clef is commonly used for higher-pitched melodies?', '["Bass clef", "Tenor clef", "Treble clef", "Alto clef"]', 2),
    ('Music', 'Which instrument uses reeds and bellows?', '["Tuba", "Accordion", "Harp", "Xylophone"]', 1),
    ('Music', 'What does the Italian term piano mean in music dynamics?', '["Quickly", "Slowly", "Softly", "Loudly"]', 2),
    ('Music', 'How many semitones are in a Western chromatic octave?', '["10", "7", "8", "12"]', 3),
    ('Music', 'Which composer wrote Clair de Lune?', '["Maurice Ravel", "Erik Satie", "Camille Saint-Saëns", "Claude Debussy"]', 3),
    ('Music', 'Which percussion instrument has tuned wooden bars struck with mallets?', '["Snare drum", "Cymbal", "Xylophone", "Tambourine"]', 2),
    ('Music', 'What musical term means to play smoothly and connected?', '["Marcato", "Legato", "Pizzicato", "Staccato"]', 1),
    ('Music', 'Who composed The Nutcracker ballet score?', '["Dmitri Shostakovich", "Sergei Prokofiev", "Igor Stravinsky", "Pyotr Ilyich Tchaikovsky"]', 3),
    ('Music', 'What do musicians call the speed of a piece?', '["Timbre", "Tempo", "Harmony", "Pitch"]', 1),
    ('Music', 'Which instrument has pedals and plucked strings in a triangular frame?', '["Cello", "Harp", "Marimba", "Clarinet"]', 1),
    ('Music', 'What type of singing involves two or more independent melodies at once?', '["Recitative", "Unison", "Polyphony", "Monophony"]', 2),
    ('Music', 'What is the name for a sequence of notes arranged by pitch?', '["Chord progression", "Scale", "Rest", "Cadence"]', 1),
    ('Technology', 'What does CPU stand for?', '["Core Processing User", "Central Program Upload", "Central Processing Unit", "Computer Power Utility"]', 2),
    ('Technology', 'What does HTML stand for?', '["High Transfer Machine Logic", "Hyperlink Text Making List", "Host Terminal Markup Language", "HyperText Markup Language"]', 3),
    ('Technology', 'What does URL stand for?', '["Universal Record Login", "Uniform Resource Locator", "Unified Render Language", "User Routing List"]', 1),
    ('Technology', 'Which company developed the Java programming language originally?', '["Nokia", "Apple", "Sun Microsystems", "IBM"]', 2),
    ('Technology', 'What does RAM stand for in computing?', '["Random Access Memory", "Runtime Active Monitor", "Rapid Array Machine", "Read Access Module"]', 0),
    ('Technology', 'Which protocol is commonly used for secure web browsing?', '["Telnet", "FTP", "SMTP", "HTTPS"]', 3),
    ('Technology', 'What does GPS stand for?', '["Global Processing Signal", "Global Positioning System", "Geographic Program Standard", "General Packet Service"]', 1),
    ('Technology', 'What is the common file extension for a JavaScript file?', '[".py", ".java", ".css", ".js"]', 3),
    ('Technology', 'What does SQL stand for?', '["Structured Query Language", "System Quality Link", "Secure Query Library", "Simple Queue Logic"]', 0),
    ('Technology', 'What does an operating system manage?', '["Only web pages", "Only image files", "Only network cables", "Computer hardware and software resources"]', 3),
    ('Technology', 'Which numeral system uses only zeros and ones?', '["Hexadecimal", "Binary", "Octal", "Decimal"]', 1),
    ('Technology', 'What does API stand for?', '["Advanced Program Installation", "Automated Processing Index", "Application Privacy Identifier", "Application Programming Interface"]', 3),
    ('Technology', 'Which device directs traffic between computer networks?', '["Scanner", "Router", "Keyboard", "Monitor"]', 1),
    ('Technology', 'What is phishing?', '["A hardware cooling technique", "A deceptive attempt to obtain sensitive information", "A method of compressing images", "A way to back up files"]', 1),
    ('Technology', 'What does CSS primarily control on a web page?', '["Domain registration", "Server hardware", "Visual styling", "Database backups"]', 2),
    ('Technology', 'Which version control system uses commands such as commit and merge?', '["DNS", "USB", "HTTP", "Git"]', 3),
    ('Technology', 'What is a common purpose of two-factor authentication?', '["Increasing download speed", "Saving disk space", "Doubling screen brightness", "Adding a second identity check"]', 3),
    ('Technology', 'What does DNS translate into IP addresses?', '["Domain names", "Password hashes", "Image pixels", "Clock signals"]', 0),
    ('Technology', 'What does USB stand for?', '["Unified System Buffer", "Universal Signal Base", "User Software Bridge", "Universal Serial Bus"]', 3),
    ('Technology', 'Which database model organizes data into tables with rows and columns?', '["Audio codec", "Graphical editor", "File compressor", "Relational database"]', 3),
    ('Mathematics', 'What is 12 multiplied by 8?', '["96", "108", "84", "88"]', 0),
    ('Mathematics', 'What is the square root of 144?', '["12", "16", "14", "10"]', 0),
    ('Mathematics', 'How many degrees are in a right angle?', '["90", "45", "180", "120"]', 0),
    ('Mathematics', 'What is 15 percent of 200?', '["15", "30", "45", "20"]', 1),
    ('Mathematics', 'What is the next prime number after 7?', '["12", "11", "9", "10"]', 1),
    ('Mathematics', 'What is the area of a rectangle measuring 6 by 4 units?', '["20 square units", "12 square units", "24 square units", "10 square units"]', 2),
    ('Mathematics', 'What is 3 cubed?', '["9", "81", "27", "6"]', 2),
    ('Mathematics', 'What is the value of pi to two decimal places?', '["3.24", "3.14", "3.04", "3.41"]', 1),
    ('Mathematics', 'How many sides does a regular hexagon have?', '["5", "7", "8", "6"]', 3),
    ('Mathematics', 'What is the median of 2, 4, and 9?', '["2", "9", "5", "4"]', 3),
    ('Mathematics', 'What is 1/4 expressed as a percentage?', '["40 percent", "75 percent", "20 percent", "25 percent"]', 3),
    ('Mathematics', 'What is the perimeter of a square with side length 5?', '["25", "20", "15", "10"]', 1),
    ('Mathematics', 'What is 7 squared?', '["49", "42", "56", "14"]', 0),
    ('Mathematics', 'What is 1000 divided by 25?', '["20", "50", "40", "25"]', 2),
    ('Mathematics', 'What is the sum of the angles in a triangle?', '["180 degrees", "90 degrees", "270 degrees", "360 degrees"]', 0),
    ('Mathematics', 'Which value is equal to 0.5?', '["One quarter", "Two thirds", "One third", "One half"]', 3),
    ('Mathematics', 'How many centimeters are in one meter?', '["100", "60", "10", "1000"]', 0),
    ('Mathematics', 'What is 9 factorial divided by 8 factorial?', '["8", "72", "1", "9"]', 3),
    ('Mathematics', 'What is the slope of the line y = 3x + 2?', '["3", "1", "5", "2"]', 0),
    ('Mathematics', 'What is the probability of rolling a 6 on a fair six-sided die?', '["1/3", "1/2", "1/12", "1/6"]', 3),
    ('Sports', 'How many innings are in a standard regulation baseball game?', '["7", "9", "10", "8"]', 1),
    ('Sports', 'What sport uses a shuttlecock?', '["Tennis", "Badminton", "Table tennis", "Squash"]', 1),
    ('Sports', 'What is the maximum score for one dart in standard darts?', '["20", "100", "60", "50"]', 2),
    ('Sports', 'How many points is a touchdown worth before the extra-point attempt?', '["6", "3", "7", "2"]', 0),
    ('Sports', 'Which sport features a pommel horse?', '["Swimming", "Gymnastics", "Boxing", "Cycling"]', 1),
    ('Sports', 'How long is an Olympic swimming pool?', '["75 meters", "25 meters", "50 meters", "100 meters"]', 2),
    ('Sports', 'How many bases form the diamond in baseball, including home plate?', '["4", "5", "6", "3"]', 0),
    ('Sports', 'In tennis, what score comes after 30 in a standard game?', '["35", "50", "40", "45"]', 2),
    ('Sports', 'What is the name of the central target in archery?', '["Bullseye", "Goal line", "Crease", "Home plate"]', 0),
    ('Sports', 'Which sport uses the terms birdie and eagle?', '["Bowling", "Golf", "Volleyball", "Cricket"]', 1),
    ('Sports', 'How many players are on court for one volleyball team during play?', '["5", "6", "7", "8"]', 1),
    ('Sports', 'In basketball, how many points is a shot made from behind the three-point line worth?', '["1", "3", "4", "2"]', 1),
    ('Sports', 'What sport uses a scrum?', '["Swimming", "Ice hockey", "Baseball", "Rugby"]', 3),
    ('Sports', 'What is a hat trick in soccer?', '["One goal from midfield", "Two goals in one half", "Three assists by one player", "Three goals by one player"]', 3),
    ('Sports', 'How many sets are needed to win a best-of-five tennis match?', '["3", "2", "5", "4"]', 0),
    ('Sports', 'Which sport has an event called the decathlon?', '["Track and field", "Cycling", "Skiing", "Rowing"]', 0),
    ('Sports', 'In boxing, what does KO stand for?', '["Key offense", "Knockout", "Kick-off", "Keeper out"]', 1),
    ('Sports', 'Which sport is played on ice with stones and brooms?', '["Speed skating", "Figure skating", "Ice hockey", "Curling"]', 3),
    ('Sports', 'How many holes are in a standard full round of golf?', '["12", "18", "24", "9"]', 1),
    ('Sports', 'Which sport uses a foil, épée, or sabre?', '["Wrestling", "Judo", "Fencing", "Archery"]', 2),
    ('Food & Culture', 'What grain is traditionally used to make risotto?', '["Oats", "Barley", "Rice", "Corn"]', 2),
    ('Food & Culture', 'What is the main ingredient in traditional hummus?', '["Peas", "Chickpeas", "Lentils", "Potatoes"]', 1),
    ('Food & Culture', 'Which country is associated with sushi''s modern culinary tradition?', '["Mexico", "Egypt", "Japan", "Norway"]', 2),
    ('Food & Culture', 'What type of pasta is shaped like small tubes?', '["Linguine", "Spaghetti", "Penne", "Fettuccine"]', 2),
    ('Food & Culture', 'Which spice is made from the dried stigmas of a flower?', '["Nutmeg", "Cinnamon", "Saffron", "Clove"]', 2),
    ('Food & Culture', 'What is tofu traditionally made from?', '["Chickpeas", "Oats", "Soybeans", "Almonds"]', 2),
    ('Food & Culture', 'What is the French term for a cooked mixture of butter and flour used to thicken sauces?', '["Bain-marie", "Roux", "Sauté", "Julienne"]', 1),
    ('Food & Culture', 'Which fruit is the main ingredient in guacamole?', '["Mango", "Tomato", "Avocado", "Papaya"]', 2),
    ('Food & Culture', 'Which country is associated with paella?', '["Spain", "France", "Greece", "Turkey"]', 0),
    ('Food & Culture', 'What is kimchi typically made from?', '["Dried rice", "Fermented vegetables", "Roasted nuts", "Steamed beans"]', 1),
    ('Food & Culture', 'What is the name of a Japanese noodle made with buckwheat?', '["Somen", "Udon", "Soba", "Ramen"]', 2),
    ('Food & Culture', 'Which bean is used to make traditional chocolate?', '["Vanilla bean", "Coffee bean", "Cacao bean", "Soybean"]', 2),
    ('Food & Culture', 'What is the primary ingredient in falafel?', '["Chickpeas or fava beans", "Potatoes", "Rice", "Wheat flour"]', 0),
    ('Food & Culture', 'Which herb is traditionally central to pesto alla Genovese?', '["Cilantro", "Mint", "Parsley", "Basil"]', 3),
    ('Food & Culture', 'What is the Spanish word for a small savory dish served with drinks?', '["Tapa", "Gazpacho", "Tortilla", "Paella"]', 0),
    ('Food & Culture', 'Which food is traditionally made by fermenting milk with bacterial cultures?', '["Corn syrup", "Olive oil", "Bread flour", "Yogurt"]', 3),
    ('Food & Culture', 'Which country is famous for the dish pho?', '["Peru", "Vietnam", "India", "Italy"]', 1),
    ('Food & Culture', 'What culinary term means cooking food briefly in boiling water then cooling it?', '["Smoking", "Braising", "Roasting", "Blanching"]', 3),
    ('Food & Culture', 'What is the main ingredient of miso paste?', '["Fermented soybeans", "Dried seaweed", "Potato starch", "Roasted peanuts"]', 0),
    ('Food & Culture', 'What is the name for a flat round bread commonly used in Mexican cuisine?', '["Tortilla", "Brioche", "Pita", "Bagel"]', 0)
)
insert into public.mai_dk_questions (category, prompt, options, correct_index)
select src.category, src.prompt, src.options_text::jsonb, src.correct_index
from source src
on conflict do nothing;

commit;

create or replace function public.mai_dk_start_match(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.mai_dk_rooms%rowtype;
  q public.mai_dk_questions%rowtype;
  deadline timestamptz;
begin
  if uid is null then raise exception 'Sign in required.'; end if;
  select * into r from public.mai_dk_rooms where id = p_room_id for update;
  if not found then raise exception 'That lobby no longer exists.'; end if;
  if r.host_id <> uid then raise exception 'Only the host can start the match.'; end if;
  if r.status <> 'waiting' then raise exception 'This match has already started.'; end if;

  deadline := clock_timestamp() + interval '15 seconds';

  update public.mai_dk_rooms
  set status = 'in_progress', match_started_at = now(), current_round = 1
  where id = p_room_id;

  select * into q from public.mai_dk_questions
  where is_active = true
  order by random()
  limit 1;

  if found then
    insert into public.mai_dk_game_rounds (room_id, round_number, category, prompt, options, correct_index, deadline_at, status)
    values (p_room_id, 1, q.category, q.prompt, q.options, q.correct_index, deadline, 'open');
  end if;
end $$;

create or replace function public.mai_dk_tick_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  room_row public.mai_dk_rooms%rowtype;
  result jsonb;
  round_row public.mai_dk_game_rounds%rowtype;
  round_json jsonb;
begin
  select * into room_row from public.mai_dk_rooms where id = p_room_id;
  if not found then raise exception 'That lobby no longer exists.'; end if;

  select * into round_row from public.mai_dk_game_rounds
  where room_id = p_room_id and status = 'open'
  order by round_number desc
  limit 1;

  if found then
    round_json := jsonb_build_object(
      'id', round_row.id,
      'round_number', round_row.round_number,
      'category', round_row.category,
      'prompt', round_row.prompt,
      'options', round_row.options,
      'status', round_row.status,
      'started_at', round_row.started_at,
      'deadline_at', round_row.deadline_at,
      'revealed_at', round_row.revealed_at,
      'correct_index', round_row.correct_index,
      'my_choice', null,
      'answered_count', coalesce((select count(*) from public.mai_dk_round_answers where round_id = round_row.id), 0),
      'results', null
    );
  else
    round_json := null;
  end if;

  select jsonb_build_object(
    'server_now', now_ts,
    'room', jsonb_build_object(
      'id', room_row.id,
      'name', room_row.name,
      'visibility', room_row.visibility,
      'status', room_row.status,
      'host_id', room_row.host_id,
      'max_players', room_row.max_players,
      'current_round', room_row.current_round,
      'total_rounds', room_row.total_rounds,
      'autostart_at', room_row.autostart_at,
      'match_started_at', room_row.match_started_at,
      'join_code', room_row.join_code
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', rp.user_id,
        'username', rp.username,
        'display_name', rp.display_name,
        'avatar_url', rp.avatar_url,
        'is_ready', rp.is_ready,
        'score', rp.score,
        'connected', rp.connected,
        'left', rp.has_left,
        'answered', rp.answered
      ) order by rp.joined_at)
      from public.mai_dk_room_players rp where rp.room_id = p_room_id
    ), '[]'),
    'round', round_json
  ) into result;
  return result;
end $$;

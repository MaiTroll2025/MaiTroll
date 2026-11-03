import { supabase } from '@/lib/supabase';
import type { Difficulty, Gender, GunKey, RunCheckpoint } from '../game/types';
export interface ActiveRun { runId:string; playerName:string; gender:Gender; difficulty:Difficulty; seed:number; lobbyId?:string; gunKey:GunKey|null; walletBalance:number; checkpoint?:RunCheckpoint; }
export interface LeaderboardEntry { playerName:string; gender:Gender; difficulty:Difficulty; score:number; levelsCleared:number; lettersCollected:number; finishedAt:string; }
export interface FinishRunInput { runId:string; playerId:string; score:number; levelsCleared:number; lettersCollected:number; coins:number; }
export interface RunInventory { checkpoints:number; equippedGun:GunKey|null; ownedGuns:GunKey[]; trollCoins:number; }
export interface Lobby { id:string; host_id:string; guest_id:string|null; difficulty:Difficulty; status:'waiting'|'playing'|'finished'|'cancelled'; seed:number; started_at:string|null; host?:{display_name:string|null}; guest?:{display_name:string|null}; }
export async function getProfile(userId:string) {
 const {data,error}=await supabase.from('user_profiles').select('id, display_name, username, troll_coins').eq('id',userId).single();
 if(error)throw error; return data;
}
export async function openWallet(playerId:string) { const p=await getProfile(playerId);return Number(p.troll_coins ?? 0); }
export async function getRunInventory():Promise<RunInventory> {
 const {data,error}=await supabase.rpc('mai_run_get_inventory');
 if(error)throw error;
 const value=data as {checkpoints?:number;equipped_gun?:GunKey|null;owned_guns?:GunKey[];troll_coins?:number|string}|null;
 if(!value)throw new Error('Could not load MaiTroll Run inventory.');
 return {checkpoints:Number(value.checkpoints??0),equippedGun:value.equipped_gun??null,ownedGuns:value.owned_guns??[],trollCoins:Number(value.troll_coins??0)};
}
export async function buyCheckpoint():Promise<RunInventory> {
 const {error}=await supabase.rpc('mai_run_buy_checkpoint');
 if(error)throw error;
 return getRunInventory();
}
export async function buyGun(gunKey:GunKey):Promise<RunInventory> {
 const {error}=await supabase.rpc('mai_run_buy_gun',{p_gun_key:gunKey});
 if(error)throw error;
 return getRunInventory();
}
export async function equipGun(gunKey:GunKey|null):Promise<RunInventory> {
 const {error}=await supabase.rpc('mai_run_equip_gun',{p_gun_key:gunKey??''});
 if(error)throw error;
 return getRunInventory();
}
export async function startRun(playerId:string,_name:string,gender:Gender,difficulty:Difficulty):Promise<string> {
 const {data,error}=await supabase.rpc('mai_run_start_solo',{p_gender:gender,p_difficulty:difficulty}); if(error)throw error;return String(data);
}
export async function completeLevel(runId:string,levelIndex:number):Promise<number> {
 const {data,error}=await supabase.rpc('mai_run_complete_level',{p_run:runId,p_level:levelIndex});
 if(error)throw error;
 const result=data as {troll_coins?:number|string}|null;
 if(!result)throw new Error('Could not confirm level reward.');
 return Number(result.troll_coins??0);
}
export async function spendCheckpoint(runId:string):Promise<number> {
 const {data,error}=await supabase.rpc('mai_run_use_checkpoint',{p_run:runId});
 if(error)throw error;
 return Number(data);
}
export async function chargeShot(runId:string):Promise<number> {
 const {data,error}=await supabase.rpc('mai_run_fire_weapon',{p_run:runId});
 if(error)throw error;
 const result=data as {troll_coins?:number|string}|null;
 if(!result)throw new Error('Could not charge for ammunition.');
 return Number(result.troll_coins??0);
}
export async function finishRun(input:FinishRunInput):Promise<{balance:number}> {
 const {error}=await supabase.rpc('mai_run_finish',{p_run:input.runId,p_score:input.score,p_levels:input.levelsCleared,p_letters:input.lettersCollected,p_collected:input.coins});
 if(error)throw error;
 return {balance:await openWallet(input.playerId)};
}
export async function fetchLeaderboard(limit=20):Promise<LeaderboardEntry[]> {
 const {data,error}=await supabase.rpc('mai_run_leaderboard',{p_limit:limit});if(error)throw error;
 return (data||[]).map((r:any)=>({playerName:String(r.player_name||'Troll'),gender:r.gender,difficulty:r.difficulty,score:Number(r.score),levelsCleared:Number(r.levels_cleared),lettersCollected:Number(r.letters_collected),finishedAt:String(r.finished_at)}));
}
export async function listLobbies():Promise<Lobby[]> { const {data,error}=await supabase.from('mai_run_lobbies').select('*').eq('status','waiting').order('created_at',{ascending:false}).limit(30);if(error)throw error;return data as Lobby[]; }
export async function createLobby(difficulty:Difficulty):Promise<string>{const {data,error}=await supabase.rpc('mai_run_create_lobby',{p_difficulty:difficulty});if(error)throw error;return String(data);}
export async function joinLobby(id:string){const {error}=await supabase.rpc('mai_run_join_lobby',{p_lobby:id});if(error)throw error;}
export async function beginMatch(id:string):Promise<string>{const {data,error}=await supabase.rpc('mai_run_begin_match',{p_lobby:id});if(error)throw error;return String(data);}
export async function getLobby(id:string):Promise<Lobby>{const {data,error}=await supabase.from('mai_run_lobbies').select('*').eq('id',id).single();if(error)throw error;return data as Lobby;}
export async function cancelLobby(id:string){const {error}=await supabase.rpc('mai_run_cancel_lobby',{p_lobby:id});if(error)throw error;}

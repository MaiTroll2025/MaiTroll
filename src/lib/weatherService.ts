// Weather API service for real-time weather data
export interface WeatherData {
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';
  temperature: number;
  windSpeed: number;
  time: 'day' | 'night' | 'sunrise' | 'sunset';
  phaseProgress?: number;
  sunriseAt?: number;
  sunsetAt?: number;
  location: string;
}

const TWILIGHT_DURATION_MS = 60 * 60 * 1000;
const SOLAR_DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDateTime(value: string, utcOffsetSeconds: number): number | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute] = match;
  return Date.UTC(+year, +month - 1, +day, +hour, +minute) - utcOffsetSeconds * 1000;
}

export function getSolarPhase(
  now: number,
  sunriseAt?: number,
  sunsetAt?: number,
): Pick<WeatherData, 'time' | 'phaseProgress'> {
  if (sunriseAt === undefined || sunsetAt === undefined) {
    const date = new Date(now);
    const sunrise = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6).getTime();
    const sunset = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18).getTime();
    return getSolarPhase(now, sunrise, sunset);
  }

  let sunrise = sunriseAt;
  let sunset = sunsetAt;
  while (now < sunrise - SOLAR_DAY_MS / 2) {
    sunrise -= SOLAR_DAY_MS;
    sunset -= SOLAR_DAY_MS;
  }
  while (now > sunset + SOLAR_DAY_MS / 2) {
    sunrise += SOLAR_DAY_MS;
    sunset += SOLAR_DAY_MS;
  }

  const sunriseStart = sunrise - TWILIGHT_DURATION_MS / 2;
  const sunriseEnd = sunrise + TWILIGHT_DURATION_MS / 2;
  const sunsetStart = sunset - TWILIGHT_DURATION_MS / 2;
  const sunsetEnd = sunset + TWILIGHT_DURATION_MS / 2;

  if (now >= sunriseStart && now <= sunriseEnd) {
    return { time: 'sunrise', phaseProgress: (now - sunriseStart) / TWILIGHT_DURATION_MS };
  }
  if (now >= sunsetStart && now <= sunsetEnd) {
    return { time: 'sunset', phaseProgress: (now - sunsetStart) / TWILIGHT_DURATION_MS };
  }
  return {
    time: now > sunriseEnd && now < sunsetStart ? 'day' : 'night',
  };
}

export async function fetchUserWeather(latitude?: number, longitude?: number): Promise<WeatherData> {
  try {
    // Get user location if not provided
    let lat = latitude;
    let lon = longitude;

    if (lat == null || lon == null) {
      // Try to get from geolocation. A denied/blocked geolocation is not an
      // error -- fall back to the default weather below.
      let geoError: GeolocationPositionError | null = null;
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 300000 // 5 minutes cache
          });
        });
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      } catch (err) {
        geoError = err as GeolocationPositionError;
      }

      if (geoError) {
        // A denied/blocked geolocation is not an error -- fall back to default
        const isPermissionDenied = geoError?.code === 1; // PERMISSION_DENIED
        if (!isPermissionDenied) {
          console.warn('[Weather] Geolocation unavailable, using default:', geoError.message);
        }
      }
    }
    // Use Open-Meteo (free, no API key needed)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode&daily=sunrise,sunset&timezone=auto`
    );
    
    if (!response.ok) throw new Error('Weather fetch failed');
    
    const data = await response.json();
    
    // Map weather codes to conditions
    const weatherCode = data.current.weathercode;
    let condition: WeatherData['condition'] = 'clear';
    
    if ([0, 1].includes(weatherCode)) condition = 'clear';
    else if ([2, 3, 45, 48].includes(weatherCode)) condition = 'cloudy';
    else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) condition = 'rain';
    else if ([95, 96, 99].includes(weatherCode)) condition = 'storm';
    else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) condition = 'snow';
    
    const utcOffsetSeconds = data.utc_offset_seconds ?? 0;
    const sunriseAt = data.daily?.sunrise?.[0]
      ? parseLocalDateTime(data.daily.sunrise[0], utcOffsetSeconds)
      : undefined;
    const sunsetAt = data.daily?.sunset?.[0]
      ? parseLocalDateTime(data.daily.sunset[0], utcOffsetSeconds)
      : undefined;
    const currentAt = parseLocalDateTime(data.current.time, utcOffsetSeconds) ?? Date.now();
    const solarPhase = getSolarPhase(currentAt, sunriseAt, sunsetAt);

    return {
      condition,
      temperature: data.current.temperature_2m,
      windSpeed: data.current.windspeed_10m,
      ...solarPhase,
      sunriseAt,
      sunsetAt,
      location: 'Current Location'
    };
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    
    // Fallback: determine based on time of day
    const date = new Date();
    const sunriseAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6).getTime();
    const sunsetAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18).getTime();

    return {
      condition: 'clear',
      temperature: 72,
      windSpeed: 5,
      ...getSolarPhase(date.getTime(), sunriseAt, sunsetAt),
      sunriseAt,
      sunsetAt,
      location: 'Default Location'
    };
  }
}

// Get sky colors based on weather and time
export function getSkyColors(weather: WeatherData) {
  const { condition, time } = weather;
  
  // Base colors
  const skyColors = {
    clear: {
      day: { top: '#87CEEB', bottom: '#E0F6FF', ambient: '#FFFFFF' },
      night: { top: '#0A1128', bottom: '#1B2845', ambient: '#2D3E5C' },
      sunrise: { top: '#FF6B35', bottom: '#F7931E', ambient: '#FFD700' },
      sunset: { top: '#FF6347', bottom: '#FF8C00', ambient: '#FFA500' }
    },
    cloudy: {
      day: { top: '#778899', bottom: '#C0C0C0', ambient: '#D3D3D3' },
      night: { top: '#2F4F4F', bottom: '#696969', ambient: '#808080' },
      sunrise: { top: '#CD853F', bottom: '#DEB887', ambient: '#F0E68C' },
      sunset: { top: '#BC8F8F', bottom: '#D2691E', ambient: '#DAA520' }
    },
    rain: {
      day: { top: '#708090', bottom: '#A9A9A9', ambient: '#B0C4DE' },
      night: { top: '#2F4F4F', bottom: '#696969', ambient: '#778899' },
      sunrise: { top: '#696969', bottom: '#808080', ambient: '#A9A9A9' },
      sunset: { top: '#696969', bottom: '#808080', ambient: '#A9A9A9' }
    },
    storm: {
      day: { top: '#36454F', bottom: '#696969', ambient: '#808080' },
      night: { top: '#0F0F0F', bottom: '#2F4F4F', ambient: '#404040' },
      sunrise: { top: '#483D8B', bottom: '#696969', ambient: '#778899' },
      sunset: { top: '#483D8B', bottom: '#696969', ambient: '#778899' }
    },
    snow: {
      day: { top: '#B0C4DE', bottom: '#F0F8FF', ambient: '#FFFFFF' },
      night: { top: '#4682B4', bottom: '#87CEEB', ambient: '#ADD8E6' },
      sunrise: { top: '#FFB6C1', bottom: '#FFF0F5', ambient: '#FFFACD' },
      sunset: { top: '#FFA07A', bottom: '#FFE4E1', ambient: '#FAFAD2' }
    }
  };
  
  if ((time === 'sunrise' || time === 'sunset') && weather.phaseProgress !== undefined) {
    const twilight = skyColors[condition][time];
    const first = skyColors[condition][time === 'sunrise' ? 'night' : 'day'];
    const last = skyColors[condition][time === 'sunrise' ? 'day' : 'night'];
    const progress = Math.max(0, Math.min(1, weather.phaseProgress));
    const blend = (from: string, to: string, amount: number) => {
      const start = Number.parseInt(from.slice(1), 16);
      const end = Number.parseInt(to.slice(1), 16);
      const channel = (shift: number) =>
        Math.round(((start >> shift) & 0xff) + (((end >> shift) & 0xff) - ((start >> shift) & 0xff)) * amount);
      return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
    };
    const from = progress < 0.5 ? first : twilight;
    const to = progress < 0.5 ? twilight : last;
    const blendProgress = progress < 0.5 ? progress * 2 : (progress - 0.5) * 2;

    return {
      top: blend(from.top, to.top, blendProgress),
      bottom: blend(from.bottom, to.bottom, blendProgress),
      ambient: blend(from.ambient, to.ambient, blendProgress),
    };
  }

  return skyColors[condition][time];
}

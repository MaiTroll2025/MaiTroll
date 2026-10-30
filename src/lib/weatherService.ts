// Weather API service for real-time weather data
export interface WeatherData {
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow';
  temperature: number;
  windSpeed: number;
  time: 'day' | 'night' | 'sunrise' | 'sunset';
  location: string;
}

export async function fetchUserWeather(latitude?: number, longitude?: number): Promise<WeatherData> {
  try {
    // Get user location if not provided
    let lat = latitude;
    let lon = longitude;

    if (!lat || !lon) {
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
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,windspeed_10m,weathercode,is_day&timezone=auto`
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
    
    // Determine time of day
    const hour = new Date().getHours();
    let time: WeatherData['time'] = 'day';
    if (data.current.is_day === 0) time = 'night';
    else if (hour >= 5 && hour < 7) time = 'sunrise';
    else if (hour >= 18 && hour < 20) time = 'sunset';
    
    return {
      condition,
      temperature: data.current.temperature_2m,
      windSpeed: data.current.windspeed_10m,
      time,
      location: 'Current Location'
    };
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    
    // Fallback: determine based on time of day
    const hour = new Date().getHours();
    let time: WeatherData['time'] = 'day';
    if (hour >= 20 || hour < 6) time = 'night';
    else if (hour >= 6 && hour < 8) time = 'sunrise';
    else if (hour >= 18 && hour < 20) time = 'sunset';
    
    return {
      condition: 'clear',
      temperature: 72,
      windSpeed: 5,
      time,
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
  
  return skyColors[condition][time];
}

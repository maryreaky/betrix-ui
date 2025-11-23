/**
 * Weather Service - Match weather impact
 * Free Open-Meteo API (no auth required)
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("WeatherService");

class WeatherService {
  constructor() {
    this.weatherApi = "https://api.open-meteo.com/v1/forecast";
  }

  /**
   * Get weather for match location
   * @param {number} latitude - City latitude
   * @param {number} longitude - City longitude
   */
  async getWeatherForLocation(latitude, longitude) {
    try {
      const response = await fetch(
        `${this.weatherApi}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,precipitation`
      );
      const data = await response.json();

      if (!data.current) return null;

      const weather = data.current;
      return {
        temp: weather.temperature_2m,
        wind: weather.wind_speed_10m,
        rain: weather.precipitation,
        condition: this.getWeatherDescription(weather.weather_code),
      };
    } catch (err) {
      logger.error("Weather fetch failed", err);
      return null;
    }
  }

  /**
   * Interpret weather code
   */
  getWeatherDescription(code) {
    const conditions = {
      0: "Clear ☀️",
      1: "Mostly Clear 🌤️",
      2: "Partly Cloudy ⛅",
      3: "Overcast ☁️",
      45: "Foggy 🌫️",
      48: "Foggy (frost) 🌫️",
      51: "Light Drizzle 🌧️",
      80: "Light Rain 🌧️",
      81: "Moderate Rain 🌧️",
      82: "Heavy Rain ⛈️",
      85: "Light Snow 🌨️",
      86: "Heavy Snow 🌨️",
    };
    return conditions[code] || "Unknown";
  }

  /**
   * Assess weather impact on match
   */
  getImpactAnalysis(weather) {
    if (!weather) return "Weather unavailable";

    let impact = [];
    if (weather.rain > 5) impact.push("Heavy rain - slippery pitch");
    if (weather.wind > 20) impact.push("Strong wind - affects long passes");
    if (weather.temp < 0) impact.push("Cold conditions - faster play");
    if (weather.temp > 30) impact.push("Hot weather - fatigue factor");

    return impact.length > 0 ? impact.join(" | ") : "Ideal conditions";
  }

  /**
   * Format weather display
   */
  static formatWeather(weather, stadium = "Match Location") {
    if (!weather)
      return `⚠️ Weather data unavailable for ${stadium}`;

    return `🌦️ <b>${stadium}</b>\n` +
      `Temperature: ${weather.temp}°C\n` +
      `Conditions: ${weather.condition}\n` +
      `Wind: ${weather.wind} km/h\n` +
      `Rain: ${weather.rain}mm`;
  }
}

export { WeatherService };

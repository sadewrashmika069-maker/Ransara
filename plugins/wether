const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

const http = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Sadew-MD-Weather-Bot/1.0",
  },
});

const weatherEmoji = {
  Thunderstorm: "⛈️",
  Drizzle: "🌦️",
  Rain: "🌧️",
  Snow: "❄️",
  Clear: "☀️",
  Clouds: "☁️",
  Mist: "🌫️",
  Haze: "🌫️",
  Fog: "🌫️",
  Sunny: "☀️",
  Overcast: "☁️",
  Patchy: "🌦️",
};

const openMeteoCodes = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function pickEmoji(desc) {
  const text = String(desc || "").toLowerCase();

  for (const key in weatherEmoji) {
    if (text.includes(key.toLowerCase())) return weatherEmoji[key];
  }

  return "🌡️";
}

function valueOrNA(value) {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value);
}

function getArrayValue(value, fallback = "") {
  return value?.[0]?.value || fallback;
}

function windDirectionFromDegrees(degrees) {
  if (degrees === undefined || degrees === null || degrees === "") return "N/A";

  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];

  const index = Math.round(Number(degrees) / 22.5) % 16;
  return directions[index] || "N/A";
}

async function react(client, m, text) {
  try {
    await client.sendMessage(m.jid, { react: { text, key: m.key } });
  } catch {}
}

async function reply(client, m, text) {
  if (typeof m.reply === "function") return m.reply(text);
  return client.sendMessage(m.jid, { text }, { quoted: m });
}

async function fetchFromWttr(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
  const { data } = await http.get(url);

  if (!data?.current_condition?.[0]) {
    throw new Error("No current condition from wttr.in");
  }

  const current = data.current_condition[0];
  const area = data.nearest_area?.[0] || {};
  const name = getArrayValue(area.areaName, city);
  const country = getArrayValue(area.country, "");
  const desc = getArrayValue(current.weatherDesc, "N/A");

  return {
    source: "wttr.in",
    name,
    country,
    temp: valueOrNA(current.temp_C),
    feels: valueOrNA(current.FeelsLikeC),
    humidity: valueOrNA(current.humidity),
    windSpeed: valueOrNA(current.windspeedKmph),
    windDir: valueOrNA(current.winddir16Point),
    visibility: valueOrNA(current.visibility),
    pressure: valueOrNA(current.pressure),
    desc,
  };
}

async function geocodeOpenMeteo(city) {
  const { data } = await http.get("https://geocoding-api.open-meteo.com/v1/search", {
    params: {
      name: city,
      count: 1,
      language: "en",
      format: "json",
    },
  });

  const place = data?.results?.[0];
  if (!place) throw new Error("City not found from Open-Meteo geocoding");

  return place;
}

async function fetchFromOpenMeteo(city) {
  const place = await geocodeOpenMeteo(city);
  const { data } = await http.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: place.latitude,
      longitude: place.longitude,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
      timezone: "auto",
    },
  });

  const current = data?.current;
  if (!current) throw new Error("No current weather from Open-Meteo");

  const desc = openMeteoCodes[current.weather_code] || "N/A";

  return {
    source: "Open-Meteo",
    name: place.name || city,
    country: place.country || "",
    temp: valueOrNA(current.temperature_2m),
    feels: valueOrNA(current.apparent_temperature),
    humidity: valueOrNA(current.relative_humidity_2m),
    windSpeed: valueOrNA(current.wind_speed_10m),
    windDir: windDirectionFromDegrees(current.wind_direction_10m),
    visibility: "N/A",
    pressure: valueOrNA(current.pressure_msl),
    desc,
  };
}

async function fetchFromGoWeather(city) {
  const url = `https://goweather.herokuapp.com/weather/${encodeURIComponent(city)}`;
  const { data } = await http.get(url);

  if (!data || data.message || !data.temperature) {
    throw new Error(data?.message || "No weather data from GoWeather");
  }

  const tempMatch = String(data.temperature).match(/-?\d+/);
  const windMatch = String(data.wind).match(/\d+/);

  return {
    source: "GoWeather",
    name: city,
    country: "",
    temp: tempMatch ? tempMatch[0] : valueOrNA(data.temperature),
    feels: "N/A",
    humidity: "N/A",
    windSpeed: windMatch ? windMatch[0] : valueOrNA(data.wind),
    windDir: "N/A",
    visibility: "N/A",
    pressure: "N/A",
    desc: valueOrNA(data.description),
  };
}

async function getWeatherWithFallback(city) {
  const apis = [fetchFromWttr, fetchFromOpenMeteo, fetchFromGoWeather];
  const errors = [];

  for (const api of apis) {
    try {
      return await api(city);
    } catch (error) {
      errors.push(`${api.name}: ${error.message}`);
      console.log(`Weather API failed - ${api.name}:`, error.message);
    }
  }

  throw new Error(errors.join(" | "));
}

function formatWeatherReport(report) {
  const dateTime = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
  });
  const emoji = pickEmoji(report.desc);

  let result = `📊 *WEATHER REPORT FOR ${report.name.toUpperCase()}* 📊\n\n`;
  result += `📍 *Location:* ${report.name}${report.country ? `, ${report.country}` : ""}\n`;
  result += `📅 *Date & Time:* ${dateTime} (SLT)\n`;
  result += `🛰️ *API Source:* ${report.source}\n`;
  result += `✨ *Condition:* ${emoji} ${report.desc}\n\n`;
  result += `🌡️ *Temperature:* ${report.temp}°C\n`;
  result += `🤝 *Feels Like:* ${report.feels}°C\n`;
  result += `💧 *Humidity:* ${report.humidity}%\n`;
  result += `💨 *Wind:* ${report.windSpeed} km/h (${report.windDir})\n`;
  result += `👁️ *Visibility:* ${report.visibility} km\n`;
  result += `⏲️ *Atmospheric Pressure:* ${report.pressure} hPa\n\n`;
  result += `*❖ Ƭʜᴇ 𝐗-𝐊𝐀𝐃𝐈𝐘𝐀-𝐌𝐃 💎*`;

  return result;
}

Sparky(
  {
    name: "w",
    alias: ["w", "weather", "climate"],
    category: "tools",
    fromMe: isPublic,
    desc: "Professional City Weather Report",
  },
  async ({ client, m, args }) => {
    const city = (Array.isArray(args) ? args.join(" ") : String(args || "")).trim();

    if (!city) {
      await react(client, m, "❓");
      return reply(
        client,
        m,
        `╭─「 *🌤️ WEATHER REPORT* 」
│
├ *Usage:* .w colombo
├ *Example:* .w kandy | .w tokyo
│
╰─ Powered by ❖Ƭʜᴇ 丂𝐚𝓭𝑒𝔀 м𝓭--💎`
      );
    }

    try {
      await react(client, m, "⏳");
      await client.sendPresenceUpdate("composing", m.jid);

      const report = await getWeatherWithFallback(city);
      const result = formatWeatherReport(report);

      await react(client, m, "🌤️");
      await client.sendMessage(m.jid, { text: result }, { quoted: m });
    } catch (err) {
      console.log("Weather Error:", err.message);
      await react(client, m, "⚠️");
      await reply(
        client,
        m,
        `⚠️ Weather API තුනම මේ වෙලාවේ response දෙන්නේ නැහැ. කරුණාකර සුළු මොහොතකින් නැවත try කරන්න.`
      );
    } finally {
      try {
        await client.sendPresenceUpdate("paused", m.jid);
      } catch {}
    }
  }
);

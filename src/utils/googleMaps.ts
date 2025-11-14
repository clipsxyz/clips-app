/**
 * Google Maps API utilities for location-based features
 * Uses Google Places API (New) for fetching regions and cities
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export interface LocationResult {
  name: string;
  placeId?: string;
  types?: string[];
}

/**
 * Fetch administrative regions (states/provinces) for a given country
 * Uses Google Places API Autocomplete with component filtering
 */
export async function fetchRegionsForCountry(countryName: string): Promise<LocationResult[]> {
  const fallbackRegions = getFallbackRegions(countryName);
  
  // If we have fallback data, use it (it's more comprehensive)
  if (fallbackRegions.length > 0) {
    return fallbackRegions;
  }

  // If no fallback data exists and we have API key, try Google Maps API
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(`No fallback data and no API key for country: ${countryName}`);
    return [];
  }

  try {
    // Use Places API (New) Text Search to find administrative areas
    // Note: This requires the new Places API which may have different pricing
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.id,places.types,places.formattedAddress'
        },
        body: JSON.stringify({
          textQuery: `administrative areas in ${countryName}`,
          maxResultCount: 50,
          includedType: 'administrative_area_level_1',
          languageCode: 'en'
        })
      }
    );

    if (!response.ok) {
      console.warn(`Google Maps API error for ${countryName}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.places && Array.isArray(data.places)) {
      const regions = data.places
        .map((place: any) => ({
          name: place.displayName?.text || place.formattedAddress || '',
          placeId: place.id,
          types: place.types
        }))
        .filter((loc: LocationResult) => loc.name);
      
      return regions.length > 0 ? regions : [];
    }

    return [];
  } catch (error) {
    console.error(`Error fetching regions from Google Maps API for ${countryName}:`, error);
    // Try fallback to old Places API Autocomplete as last resort
    try {
      const countryCode = getCountryCode(countryName);
      if (!countryCode) return [];
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(countryName)}&types=(regions)&components=country:${countryCode}&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.predictions && Array.isArray(data.predictions)) {
          return data.predictions
            .map((pred: any) => ({
              name: pred.description.split(',')[0],
              placeId: pred.place_id
            }))
            .filter((loc: LocationResult) => loc.name);
        }
      }
    } catch (fallbackError) {
      console.error('Fallback API also failed:', fallbackError);
    }
    
    return [];
  }
}

/**
 * Fetch local areas/neighborhoods for a given region/state
 * Note: "Local" refers to local areas/neighborhoods, not cities
 * Uses Google Places API for local area suggestions
 */
export async function fetchCitiesForRegion(regionName: string, countryName: string): Promise<LocationResult[]> {
  console.log(`[fetchCitiesForRegion] Called with region: "${regionName}", country: "${countryName}"`);
  console.log(`[fetchCitiesForRegion] Region name type: ${typeof regionName}, length: ${regionName?.length}, trimmed: "${regionName?.trim()}"`);
  
  const fallbackLocalAreas = getFallbackCities(regionName); // This function actually returns local areas
  console.log(`[fetchCitiesForRegion] Fallback local areas found: ${fallbackLocalAreas.length} for region: "${regionName}"`);
  
  if (fallbackLocalAreas.length > 0) {
    console.log(`[fetchCitiesForRegion] ✅ SUCCESS: Using ${fallbackLocalAreas.length} fallback local areas:`, fallbackLocalAreas.slice(0, 5).map(a => a.name));
    return fallbackLocalAreas;
  } else {
    console.warn(`[fetchCitiesForRegion] ⚠️ WARNING: No fallback data found for region: "${regionName}"`);
  }

  // If no fallback data exists and we have API key, try Google Maps API
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn(`No fallback data and no API key for region: ${regionName}, ${countryName}`);
    return [];
  }

  try {
    // Use Places API (New) Text Search to find local areas/neighborhoods in the region
    // Try to find neighborhoods, districts, or sub-localities
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.id,places.types,places.formattedAddress'
        },
        body: JSON.stringify({
          textQuery: `local areas neighborhoods districts in ${regionName}, ${countryName}`,
          maxResultCount: 50,
          includedType: 'sublocality',
          languageCode: 'en'
        })
      }
    );

    if (!response.ok) {
      console.warn(`Google Maps API error for ${regionName}, ${countryName}: ${response.status}`);
      // Fall back to old Places API or try with different types
      return await fetchLocalAreasFallback(regionName, countryName);
    }

    const data = await response.json();
    
    if (data.places && Array.isArray(data.places)) {
      const localAreas = data.places
        .map((place: any) => ({
          name: place.displayName?.text || place.formattedAddress || '',
          placeId: place.id,
          types: place.types
        }))
        .filter((loc: LocationResult) => loc.name);
      
      return localAreas.length > 0 ? localAreas : await fetchLocalAreasFallback(regionName, countryName);
    }

    return await fetchLocalAreasFallback(regionName, countryName);
  } catch (error) {
    console.error(`Error fetching local areas from Google Maps API for ${regionName}, ${countryName}:`, error);
    return await fetchLocalAreasFallback(regionName, countryName);
  }
}

/**
 * Fallback to old Places API Autocomplete for local areas/neighborhoods
 */
async function fetchLocalAreasFallback(regionName: string, countryName: string): Promise<LocationResult[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  
  try {
    const countryCode = getCountryCode(countryName);
    if (!countryCode) return [];
    
    // Try to find sublocalities (neighborhoods/local areas) first
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(regionName)}&types=(sublocality)&components=country:${countryCode}&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (!response.ok) {
      // If sublocality doesn't work, try with cities as fallback (some regions use cities as local areas)
      const cityResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(regionName)}&types=(cities)&components=country:${countryCode}&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      if (!cityResponse.ok) {
        return [];
      }
      
      const cityData = await cityResponse.json();
      if (cityData.predictions && Array.isArray(cityData.predictions)) {
        return cityData.predictions
          .map((pred: any) => ({
            name: pred.description.split(',')[0],
            placeId: pred.place_id
          }))
          .filter((loc: LocationResult) => loc.name);
      }
      
      return [];
    }

    const data = await response.json();
    
    if (data.predictions && Array.isArray(data.predictions)) {
      const localAreas = data.predictions
        .map((pred: any) => ({
          name: pred.description.split(',')[0], // Extract local area name
          placeId: pred.place_id
        }))
        .filter((loc: LocationResult) => loc.name);
      
      return localAreas;
    }

    return [];
  } catch (error) {
    console.error('Fallback API also failed:', error);
    return [];
  }
}

/**
 * Get ISO country code for Google Maps API
 */
function getCountryCode(countryName: string): string {
  const countryCodes: Record<string, string> = {
    // Europe
    'Ireland': 'ie', 'Northern Ireland': 'gb', 'UK': 'gb', 'Germany': 'de', 'France': 'fr',
    'Spain': 'es', 'Italy': 'it', 'Netherlands': 'nl', 'Belgium': 'be', 'Switzerland': 'ch',
    'Austria': 'at', 'Poland': 'pl', 'Portugal': 'pt', 'Greece': 'gr', 'Sweden': 'se',
    'Norway': 'no', 'Denmark': 'dk', 'Finland': 'fi', 'Czech Republic': 'cz', 'Romania': 'ro',
    'Hungary': 'hu', 'Bulgaria': 'bg', 'Croatia': 'hr', 'Serbia': 'rs', 'Slovakia': 'sk',
    'Slovenia': 'si', 'Lithuania': 'lt', 'Latvia': 'lv', 'Estonia': 'ee', 'Luxembourg': 'lu',
    'Malta': 'mt', 'Cyprus': 'cy', 'Iceland': 'is', 'Ukraine': 'ua', 'Belarus': 'by',
    'Moldova': 'md', 'Albania': 'al', 'North Macedonia': 'mk', 'Bosnia and Herzegovina': 'ba',
    'Montenegro': 'me', 'Kosovo': 'xk', 'Monaco': 'mc', 'Liechtenstein': 'li', 'Andorra': 'ad',
    'San Marino': 'sm', 'Vatican City': 'va', 'Turkey': 'tr',
    
    // Americas
    'USA': 'us', 'Canada': 'ca', 'Mexico': 'mx', 'Brazil': 'br', 'Argentina': 'ar',
    'Chile': 'cl', 'Colombia': 'co', 'Peru': 'pe', 'Venezuela': 've', 'Ecuador': 'ec',
    'Guatemala': 'gt', 'Cuba': 'cu', 'Haiti': 'ht', 'Dominican Republic': 'do',
    'Honduras': 'hn', 'El Salvador': 'sv', 'Nicaragua': 'ni', 'Costa Rica': 'cr',
    'Panama': 'pa', 'Uruguay': 'uy', 'Paraguay': 'py', 'Bolivia': 'bo', 'Jamaica': 'jm',
    'Trinidad and Tobago': 'tt', 'Bahamas': 'bs', 'Barbados': 'bb', 'Belize': 'bz',
    'Guyana': 'gy', 'Suriname': 'sr', 'French Guiana': 'gf', 'Saint Lucia': 'lc',
    'Antigua and Barbuda': 'ag', 'Saint Vincent and the Grenadines': 'vc', 'Grenada': 'gd',
    'Saint Kitts and Nevis': 'kn', 'Dominica': 'dm', 'Aruba': 'aw', 'Curaçao': 'cw',
    'Bonaire': 'bq', 'Sint Maarten': 'sx', 'Sint Eustatius': 'bq', 'Saba': 'bq',
    'Bermuda': 'bm', 'Cayman Islands': 'ky', 'British Virgin Islands': 'vg',
    'US Virgin Islands': 'vi', 'Anguilla': 'ai', 'Montserrat': 'ms', 'Turks and Caicos Islands': 'tc',
    'Greenland': 'gl', 'Saint Pierre and Miquelon': 'pm',
    
    // Asia
    'China': 'cn', 'India': 'in', 'Japan': 'jp', 'Russia': 'ru', 'Indonesia': 'id',
    'Pakistan': 'pk', 'Bangladesh': 'bd', 'Philippines': 'ph', 'Vietnam': 'vn',
    'Thailand': 'th', 'Myanmar': 'mm', 'South Korea': 'kr', 'North Korea': 'kp',
    'Malaysia': 'my', 'Afghanistan': 'af', 'Iraq': 'iq', 'Saudi Arabia': 'sa',
    'Uzbekistan': 'uz', 'Yemen': 'ye', 'Nepal': 'np', 'Sri Lanka': 'lk',
    'Kazakhstan': 'kz', 'Cambodia': 'kh', 'Jordan': 'jo', 'Azerbaijan': 'az',
    'United Arab Emirates': 'ae', 'Tajikistan': 'tj', 'Israel': 'il', 'Laos': 'la',
    'Lebanon': 'lb', 'Kyrgyzstan': 'kg', 'Turkmenistan': 'tm', 'Singapore': 'sg',
    'Oman': 'om', 'Palestine': 'ps', 'Kuwait': 'kw', 'Georgia': 'ge', 'Mongolia': 'mn',
    'Armenia': 'am', 'Qatar': 'qa', 'Bahrain': 'bh', 'Timor-Leste': 'tl', 'Bhutan': 'bt',
    'Maldives': 'mv', 'Brunei': 'bn', 'Iran': 'ir', 'Syria': 'sy', 'Turkey': 'tr',
    
    // Africa
    'Nigeria': 'ng', 'Ethiopia': 'et', 'Egypt': 'eg', 'South Africa': 'za', 'Kenya': 'ke',
    'Uganda': 'ug', 'Tanzania': 'tz', 'Algeria': 'dz', 'Sudan': 'sd', 'Morocco': 'ma',
    'Angola': 'ao', 'Mozambique': 'mz', 'Ghana': 'gh', 'Madagascar': 'mg', 'Cameroon': 'cm',
    'Ivory Coast': 'ci', 'Niger': 'ne', 'Burkina Faso': 'bf', 'Mali': 'ml', 'Malawi': 'mw',
    'Zambia': 'zm', 'Senegal': 'sn', 'Chad': 'td', 'Somalia': 'so', 'Zimbabwe': 'zw',
    'Guinea': 'gn', 'Rwanda': 'rw', 'Benin': 'bj', 'Tunisia': 'tn', 'Burundi': 'bi',
    'South Sudan': 'ss', 'Togo': 'tg', 'Sierra Leone': 'sl', 'Libya': 'ly', 'Eritrea': 'er',
    'Central African Republic': 'cf', 'Liberia': 'lr', 'Mauritania': 'mr', 'Namibia': 'na',
    'Botswana': 'bw', 'Gambia': 'gm', 'Gabon': 'ga', 'Lesotho': 'ls', 'Guinea-Bissau': 'gw',
    'Equatorial Guinea': 'gq', 'Mauritius': 'mu', 'Eswatini': 'sz', 'Djibouti': 'dj',
    'Comoros': 'km', 'Cape Verde': 'cv', 'São Tomé and Príncipe': 'st', 'Seychelles': 'sc',
    
    // Oceania
    'Australia': 'au', 'New Zealand': 'nz', 'Papua New Guinea': 'pg', 'Fiji': 'fj',
    'Solomon Islands': 'sb', 'Vanuatu': 'vu', 'New Caledonia': 'nc', 'French Polynesia': 'pf',
    'Samoa': 'ws', 'Guam': 'gu', 'Kiribati': 'ki', 'Micronesia': 'fm', 'Tonga': 'to',
    'Marshall Islands': 'mh', 'Palau': 'pw', 'American Samoa': 'as', 'Northern Mariana Islands': 'mp',
    'Cook Islands': 'ck', 'Tuvalu': 'tv', 'Wallis and Futuna': 'wf', 'Nauru': 'nr',
    'Niue': 'nu', 'Tokelau': 'tk', 'Pitcairn Islands': 'pn'
  };
  return countryCodes[countryName] || '';
}

/**
 * Fallback regions when API is not available
 */
function getFallbackRegions(countryName: string): LocationResult[] {
  const fallbackData: Record<string, string[]> = {
    'USA': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
    'Ireland': ['Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Kilkenny', 'Sligo', 'Donegal', 'Kerry', 'Mayo', 'Clare', 'Tipperary', 'Wexford', 'Wicklow', 'Meath', 'Louth', 'Kildare', 'Carlow', 'Laois', 'Offaly', 'Westmeath', 'Longford', 'Roscommon', 'Leitrim', 'Cavan', 'Monaghan'],
    'Northern Ireland': ['Antrim', 'Armagh', 'Down', 'Fermanagh', 'Londonderry', 'Tyrone'], // Treated as a country option but has regions
    'UK': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    'Canada': ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'],
    'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania', 'Northern Territory', 'Australian Capital Territory'],
    'New Zealand': ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke\'s Bay', 'Manawatu-Wanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'],
    'Germany': ['Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia'],
    'France': ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d\'Azur', 'Nouvelle-Aquitaine', 'Occitanie', 'Hauts-de-France', 'Grand Est', 'Pays de la Loire', 'Normandy', 'Brittany', 'Bourgogne-Franche-Comté', 'Centre-Val de Loire', 'Corsica'],
    'Spain': ['Andalusia', 'Aragon', 'Asturias', 'Balearic Islands', 'Basque Country', 'Canary Islands', 'Cantabria', 'Castile and León', 'Castile-La Mancha', 'Catalonia', 'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Murcia', 'Navarre', 'Valencia'],
    'Italy': ['Lombardy', 'Lazio', 'Campania', 'Sicily', 'Veneto', 'Emilia-Romagna', 'Piedmont', 'Puglia', 'Tuscany', 'Calabria', 'Sardinia', 'Liguria', 'Marche', 'Abruzzo', 'Umbria', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', 'Basilicata', 'Molise', 'Aosta Valley'],
    'Russia': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan', 'Nizhny Novgorod', 'Chelyabinsk', 'Samara', 'Omsk', 'Rostov-on-Don', 'Ufa', 'Krasnoyarsk', 'Voronezh', 'Perm', 'Volgograd', 'Krasnodar', 'Saratov', 'Tyumen', 'Tolyatti', 'Izhevsk', 'Barnaul', 'Ulyanovsk', 'Irkutsk', 'Khabarovsk', 'Yaroslavl', 'Vladivostok', 'Makhachkala', 'Tomsk', 'Orenburg', 'Kemerovo', 'Novokuznetsk', 'Ryazan', 'Naberezhnye Chelny', 'Astrakhan', 'Penza', 'Lipetsk', 'Kirov', 'Cheboksary', 'Kaliningrad', 'Tula', 'Kursk', 'Sochi', 'Stavropol', 'Ulan-Ude', 'Tver', 'Magnitogorsk', 'Ivanovo', 'Bryansk', 'Surgut', 'Belgorod', 'Vladimir', 'Arkhangelsk', 'Kaluga', 'Chita', 'Smolensk', 'Volzhsky', 'Kurgan', 'Cherepovets', 'Vologda', 'Saransk', 'Tambov', 'Yoshkar-Ola', 'Oryol', 'Kostroma', 'Petrozavodsk', 'Nizhnevartovsk', 'Novorossiysk', 'Nizhnekamsk', 'Dzerzhinsk', 'Shakhty', 'Bratsk', 'Nalchik', 'Orsk', 'Syktyvkar', 'Nizhny Tagil', 'Sterlitamak', 'Angarsk', 'Novocherkassk', 'Blagoveshchensk', 'Stary Oskol', 'Veliky Novgorod', 'Korolyov', 'Pskov', 'Biysk', 'Prokopyevsk', 'Yuzhno-Sakhalinsk', 'Balakovo', 'Armavir', 'Rybinsk', 'Severodvinsk', 'Abakan', 'Norilsk', 'Rubtsovsk', 'Petropavlovsk-Kamchatsky', 'Syzran', 'Novomoskovsk', 'Kamensk-Uralsky', 'Zlatoust', 'Essentuki', 'Volgodonsk', 'Ussuriysk', 'Salavat', 'Miass', 'Obninsk', 'Nakhodka', 'Khasavyurt', 'Kislovodsk', 'Dimitrovgrad', 'Neftekamsk', 'Nefteyugansk', 'Kaspiysk', 'Novotroitsk', 'Cherkessk', 'Derbent', 'Kyzyl', 'Elista', 'Magas', 'Grozny', 'Nazran', 'Maykop', 'Cherkessk', 'Yakutsk', 'Vladikavkaz', 'Makhachkala', 'Nalchik', 'Elista', 'Gorno-Altaysk', 'Abakan', 'Kyzyl', 'Ulan-Ude', 'Chita', 'Blagoveshchensk', 'Yakutsk', 'Magadan', 'Petropavlovsk-Kamchatsky', 'Anadyr', 'Murmansk', 'Arkhangelsk', 'Syktyvkar', 'Naryan-Mar', 'Salekhard', 'Khanty-Mansiysk', 'Tyumen', 'Omsk', 'Novosibirsk', 'Krasnoyarsk', 'Irkutsk', 'Yakutsk', 'Vladivostok', 'Khabarovsk', 'Blagoveshchensk', 'Chita', 'Ulan-Ude', 'Kyzyl', 'Abakan', 'Gorno-Altaysk', 'Barnaul', 'Kemerovo', 'Novokuznetsk', 'Tomsk', 'Omsk', 'Novosibirsk', 'Krasnoyarsk', 'Achinsk', 'Kansk', 'Zelenogorsk', 'Zheleznogorsk', 'Lesosibirsk', 'Minusinsk', 'Norilsk', 'Sayansk', 'Sosnovoborsk', 'Uzhur', 'Sharypovo', 'Divnogorsk', 'Borodino', 'Kodinsk', 'Bogotol', 'Uyar', 'Nazarovo', 'Shushenskoye', 'Krasnoturansk', 'Kuragino', 'Partizansk', 'Artem', 'Ussuriysk', 'Nakhodka', 'Spassk-Dalny', 'Lesozavodsk', 'Dalnerechensk', 'Dalnegorsk', 'Kavalerovo', 'Luchegorsk', 'Pozharsky', 'Terney', 'Krasnoarmeysk', 'Anuchino', 'Yakovlevka', 'Chernigovka', 'Spassk', 'Mikhailovka', 'Kirovsky', 'Chuguyevka', 'Kirovskoye', 'Novokachalinsk', 'Slavyanka', 'Zarubino', 'Kraskino', 'Khasan', 'Barabash', 'Bezverkhovo', 'Vladimiro-Aleksandrovskoye', 'Preobrazheniye', 'Rudnaya Pristan', 'Terney', 'Plastun', 'Dalnegorsk', 'Kavalerovo', 'Luchegorsk', 'Pozharsky', 'Terney', 'Krasnoarmeysk', 'Anuchino', 'Yakovlevka', 'Chernigovka', 'Spassk', 'Mikhailovka', 'Kirovsky', 'Chuguyevka', 'Kirovskoye', 'Novokachalinsk', 'Slavyanka', 'Zarubino', 'Kraskino', 'Khasan', 'Barabash', 'Bezverkhovo', 'Vladimiro-Aleksandrovskoye', 'Preobrazheniye', 'Rudnaya Pristan'],
    'Japan': ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kobe', 'Kawasaki', 'Kyoto', 'Saitama', 'Hiroshima', 'Sendai', 'Chiba', 'Kitakyushu', 'Setagaya', 'Sakai', 'Niigata', 'Hamamatsu', 'Shizuoka', 'Sagamihara', 'Okayama', 'Kumamoto', 'Kagoshima', 'Hachioji', 'Funabashi', 'Matsuyama', 'Higashiosaka', 'Kawaguchi', 'Himeji', 'Utsunomiya', 'Matsudo', 'Nishinomiya', 'Kurashiki', 'Ichikawa', 'Oita', 'Fukuyama', 'Amagasaki', 'Kanazawa', 'Nagano', 'Toyama', 'Gifu', 'Mito', 'Fukushima', 'Aomori', 'Akita', 'Morioka', 'Yamagata', 'Fukui', 'Tottori', 'Matsue', 'Kochi', 'Takamatsu', 'Tokushima', 'Nara', 'Wakayama', 'Tsu', 'Otsu', 'Maebashi', 'Urawa', 'Chiba', 'Yokosuka', 'Fujisawa', 'Asahikawa', 'Iwaki', 'Koriyama', 'Aizuwakamatsu', 'Koriyama', 'Fukushima', 'Sendai', 'Ishinomaki', 'Kesennuma', 'Ofunato', 'Rikuzentakata', 'Kamaishi', 'Miyako', 'Yamada', 'Otsuchi', 'Kamaishi', 'Ofunato', 'Rikuzentakata', 'Kesennuma', 'Ishinomaki', 'Sendai', 'Natori', 'Iwanuma', 'Watari', 'Yamamoto', 'Higashimatsushima', 'Onagawa', 'Minamisanriku', 'Shichigahama', 'Tagajo', 'Rifu', 'Shiogama', 'Matsushima', 'Zaō', 'Shiroishi', 'Kakuda', 'Marumori', 'Yamamoto', 'Watari', 'Iwanuma', 'Natori', 'Sendai', 'Ishinomaki', 'Kesennuma', 'Ofunato', 'Rikuzentakata', 'Kamaishi', 'Miyako', 'Yamada', 'Otsuchi', 'Kamaishi', 'Ofunato', 'Rikuzentakata', 'Kesennuma', 'Ishinomaki', 'Sendai', 'Natori', 'Iwanuma', 'Watari', 'Yamamoto', 'Higashimatsushima', 'Onagawa', 'Minamisanriku', 'Shichigahama', 'Tagajo', 'Rifu', 'Shiogama', 'Matsushima', 'Zaō', 'Shiroishi', 'Kakuda', 'Marumori', 'Yamamoto', 'Watari', 'Iwanuma', 'Natori', 'Sendai'],
    'China': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou', 'Wuhan', 'Xi\'an', 'Nanjing', 'Tianjin', 'Chongqing', 'Shenyang', 'Qingdao', 'Dalian', 'Dongguan', 'Foshan', 'Jinan', 'Zhengzhou', 'Changsha', 'Kunming', 'Harbin', 'Changchun', 'Shijiazhuang', 'Taiyuan', 'Nanchang', 'Hefei', 'Fuzhou', 'Xiamen', 'Haikou', 'Nanning', 'Guiyang', 'Lanzhou', 'Yinchuan', 'Xining', 'Urumqi', 'Lhasa', 'Hohhot', 'Shantou', 'Zhuhai', 'Zhongshan', 'Jiangmen', 'Huizhou', 'Zhaoqing', 'Qingyuan', 'Shaoguan', 'Meizhou', 'Heyuan', 'Yangjiang', 'Maoming', 'Zhanjiang', 'Chaozhou', 'Jieyang', 'Shanwei', 'Yunfu', 'Chaoyang', 'Jieyang', 'Meizhou', 'Heyuan', 'Yangjiang', 'Maoming', 'Zhanjiang', 'Chaozhou', 'Jieyang', 'Shanwei', 'Yunfu', 'Chaoyang'],
    'India': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Amritsar', 'Ranchi', 'Chandigarh', 'Jodhpur', 'Raipur', 'Gwalior', 'Jamshedpur', 'Bhubaneswar', 'Coimbatore', 'Madurai', 'Vijayawada', 'Jabalpur', 'Allahabad', 'Aurangabad', 'Solapur', 'Tiruchirappalli', 'Bareilly', 'Moradabad', 'Mysore', 'Tiruppur', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Bhubaneswar', 'Salem', 'Warangal', 'Guntur', 'Bhiwandi', 'Saharanpur', 'Gorakhpur', 'Bikaner', 'Amravati', 'Noida', 'Jamshedpur', 'Bhilai', 'Cuttack', 'Firozabad', 'Kochi', 'Nellore', 'Bhavnagar', 'Dehradun', 'Durgapur', 'Asansol', 'Rourkela', 'Nanded', 'Kolhapur', 'Ajmer', 'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri', 'Jhansi', 'Ulhasnagar', 'Jammu', 'Sangli-Miraj', 'Mangalore', 'Erode', 'Belgaum', 'Ambattur', 'Tirunelveli', 'Malegaon', 'Gaya', 'Jalgaon', 'Udaipur', 'Maheshtala', 'Tirupati', 'Davanagere', 'Kozhikode', 'Akola', 'Kurnool', 'Bokaro Steel City', 'Rajahmundry', 'Ballari', 'Agartala', 'Bhagalpur', 'Latur', 'Dhule', 'Korba', 'Bhilwara', 'Brahmapur', 'Muzaffarpur', 'Ahmednagar', 'Mathura', 'Kollam', 'Avadi', 'Kadapa', 'Anantapur', 'Tumkur', 'Khammam', 'Ozhukarai', 'Bihar Sharif', 'Panipat', 'Darbhanga', 'Bally', 'Aizawl', 'Dewas', 'Ichalkaranji', 'Tirupur', 'Karnal', 'Bathinda', 'Jalna', 'Eluru', 'Barasat', 'Kirari Suleman Nagar', 'Purnia', 'Satna', 'Mau', 'Sonipat', 'Farrukhabad', 'Sagar', 'Rourkela', 'Durg', 'Imphal', 'Ratlam', 'Hapur', 'Arrah', 'Karimnagar', 'Anantapur', 'Etawah', 'Bharatpur', 'Begusarai', 'New Delhi', 'Chhapra', 'Kadapa', 'Ramagundam', 'Pali', 'Satna', 'Vizianagaram', 'Katihar', 'Hardwar', 'Sonipat', 'Nagercoil', 'Thanjavur', 'Murwara', 'Naihati', 'Sambhal', 'Nadiad', 'Yamunanagar', 'Eluru', 'Kurnool', 'Panipat', 'Raebareli', 'Mathura', 'Pudukkottai', 'Shahjahanpur', 'Bhimavaram', 'Robertsganj', 'Haldia', 'Suryapet', 'Kaithal', 'Raj Nandgaon', 'Bhadravati', 'Chandrapur', 'Chittoor', 'Bhusawal', 'Panvel', 'Budaun', 'Jagdalpur', 'Motihari', 'Rampur', 'Deoghar', 'Phusro', 'Ongole', 'Nabadwip', 'Sasaram', 'Hazaribagh', 'Palayankottai', 'Banda', 'Godhra', 'Hospet', 'Ashok Nagar', 'Sardarshahar', 'Mahuva', 'Bongaigaon', 'Dehri', 'Madanapalle', 'Malerkotla', 'Lalitpur', 'Bettiah', 'Pollachi', 'Khanna', 'Neemuch', 'Palwal', 'Palanpur', 'Guntakal', 'Nabadwip', 'Udupi', 'Jagdalpur', 'Motihari', 'Pilibhit', 'Shamsabad', 'Berhampore', 'Katni', 'Buxar', 'Kasganj', 'Sasaram', 'Sohna', 'Sirsa', 'Tanda', 'Mirzapur', 'Chhindwara', 'Jharsuguda', 'Baripada', 'Phagwara', 'Barmer', 'Bijnor', 'Bhadrak', 'Purulia', 'Bankura', 'Raniganj', 'Suri', 'Rampurhat', 'Nalhati', 'Bolpur', 'Santiniketan', 'Krishnanagar', 'Berhampore', 'Baharampur', 'Murshidabad', 'Jangipur', 'Dhulian', 'Farakka', 'Suti', 'Samserganj', 'Sagardighi', 'Lalgola', 'Nabagram', 'Kandi', 'Beldanga', 'Rejinagar', 'Domkal', 'Jalangi', 'Raghunathganj', 'Suti', 'Samserganj', 'Sagardighi', 'Lalgola', 'Nabagram', 'Kandi', 'Beldanga', 'Rejinagar', 'Domkal', 'Jalangi', 'Raghunathganj'],
    'Brazil': ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba', 'Recife', 'Porto Alegre', 'Belém', 'Goiânia', 'Guarulhos', 'Campinas', 'São Luís', 'São Gonçalo', 'Maceió', 'Duque de Caxias', 'Natal', 'Teresina', 'Campo Grande', 'Nova Iguaçu', 'São Bernardo do Campo', 'João Pessoa', 'Santo André', 'Osasco', 'Jaboatão dos Guararapes', 'São José dos Campos', 'Ribeirão Preto', 'Uberlândia', 'Contagem', 'Aracaju', 'Feira de Santana', 'Cuiabá', 'Joinville', 'Aparecida de Goiânia', 'Londrina', 'Juiz de Fora', 'Ananindeua', 'Porto Velho', 'Serra', 'Niterói', 'Caxias do Sul', 'Campos dos Goytacazes', 'Macapá', 'Vila Velha', 'Florianópolis', 'Mauá', 'São João de Meriti', 'Diadema', 'Carapicuíba', 'Olinda', 'Campina Grande', 'Maringá', 'Montes Claros', 'Betim', 'Cariacica', 'Caruaru', 'Vitória', 'Blumenau', 'Caucaia', 'Petrolina', 'Franca', 'Ponta Grossa', 'Vitória da Conquista', 'Paulista', 'Canoas', 'Pelotas', 'Bauru', 'Anápolis', 'Ribeirão das Neves', 'Uberaba', 'Foz do Iguaçu', 'Volta Redonda', 'Petrópolis', 'Praia Grande', 'Suzano', 'Guarujá', 'Taubaté', 'Barueri', 'Cascavel', 'Várzea Grande', 'Juazeiro do Norte', 'Piracicaba', 'Camaçari', 'Jundiaí', 'Sorocaba', 'Limeira', 'Americana', 'Araraquara', 'Itaquaquecetuba', 'São José de Ribamar', 'Rio Branco', 'Arapiraca', 'Colombo', 'Palmas', 'Santarém', 'Mossoró', 'Magé', 'Sete Lagoas', 'Sobral', 'Rio Claro', 'Araguaína', 'Cabo Frio', 'Itabuna', 'Marília', 'Divinópolis', 'São Vicente', 'Santa Maria', 'Novo Hamburgo', 'Caxias', 'Barra Mansa', 'Viamão', 'São Caetano do Sul', 'Sumaré', 'Governador Valadares', 'Rio Verde', 'Chapecó', 'Imperatriz', 'Gravataí', 'Embu das Artes', 'Várzea Paulista', 'Taboão da Serra', 'Várzea Grande', 'Santa Luzia', 'Maracanaú', 'Cabo de Santo Agostinho', 'Dourados', 'Juazeiro', 'Rio Grande', 'Apucarana', 'Itapevi', 'Cotia', 'Barretos', 'Araras', 'Pindamonhangaba', 'Jacareí', 'Bragança Paulista', 'Itu', 'Salto', 'Indaiatuba', 'Hortolândia', 'Valinhos', 'Vinhedo', 'Louveira', 'Jaguariúna', 'Pedreira', 'Amparo', 'Monte Mor', 'Engenheiro Coelho', 'Artur Nogueira', 'Cosmópolis', 'Holambra', 'Santo Antônio de Posse', 'Mogi Guaçu', 'Mogi Mirim', 'Conchal', 'Estiva Gerbi', 'Espírito Santo do Pinhal', 'Águas de Lindóia', 'Lindóia', 'Serra Negra', 'Monte Alegre do Sul', 'Pedra Bela', 'Pinhalzinho', 'Socorro', 'Tuiuti', 'Vargem', 'Amparo', 'Monte Alegre do Sul', 'Pedra Bela', 'Pinhalzinho', 'Socorro', 'Tuiuti', 'Vargem'],
    'Mexico': ['Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Torreón', 'Querétaro', 'San Luis Potosí', 'Mérida', 'Mexicali', 'Aguascalientes', 'Tampico', 'Culiacán', 'Cuernavaca', 'Acapulco', 'Tlalnepantla', 'Chihuahua', 'Morelia', 'Saltillo', 'Xalapa', 'Villahermosa', 'Hermosillo', 'Reynosa', 'Cancún', 'Tepic', 'Oaxaca', 'Tuxtla Gutiérrez', 'Durango', 'Veracruz', 'Mazatlán', 'Irapuato', 'Ensenada', 'Celaya', 'Toluca', 'Chimalhuacán', 'Nezahualcóyotl', 'Naucalpan', 'Ecatepec', 'Tlalpan', 'Gustavo A. Madero', 'Álvaro Obregón', 'Benito Juárez', 'Cuauhtémoc', 'Miguel Hidalgo', 'Venustiano Carranza', 'Iztacalco', 'Iztapalapa', 'Magdalena Contreras', 'Milpa Alta', 'Tláhuac', 'Xochimilco', 'Coyoacán', 'Azcapotzalco', 'Cuajimalpa', 'La Magdalena Contreras', 'Milpa Alta', 'Tláhuac', 'Xochimilco', 'Coyoacán', 'Azcapotzalco', 'Cuajimalpa'],
    'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen', 'Enschede', 'Haarlem', 'Arnhem', 'Zaanstad', 'Amersfoort', 'Apeldoorn', '\'s-Hertogenbosch', 'Hoofddorp', 'Maastricht', 'Leiden', 'Dordrecht', 'Zoetermeer', 'Zwolle', 'Deventer', 'Delft', 'Heerlen', 'Alkmaar', 'Venlo', 'Leeuwarden', 'Hilversum', 'Amstelveen', 'Roosendaal', 'Purmerend', 'Schiedam', 'Vlaardingen', 'Alphen aan den Rijn', 'Spijkenisse', 'Helmond', 'Veenendaal', 'Gouda', 'Zaandam', 'Hengelo', 'Katwijk', 'Barneveld', 'De Bilt', 'Capelle aan den IJssel', 'Den Helder', 'Venray', 'Velsen', 'Westland', 'Emmen', 'Diemen', 'Kerkrade', 'Heemskerk', 'Rijswijk', 'Middelburg', 'Ede', 'Doetinchem', 'Harderwijk', 'Zwijndrecht', 'Dronten', 'Oss', 'Roermond', 'Sittard-Geleen', 'Tiel', 'Veldhoven', 'Weert', 'Winterswijk', 'Zutphen', 'Almelo', 'Beverwijk', 'Culemborg', 'Delfzijl', 'Goes', 'Gorinchem', 'Heerhugowaard', 'Hoogeveen', 'Kampen', 'Lelystad', 'Meppel', 'Nieuwegein', 'Papendrecht', 'Ridderkerk', 'Sneek', 'Steenbergen', 'Terneuzen', 'Vlissingen', 'Waalwijk', 'Woerden', 'Zaltbommel', 'Zeist', 'Zevenaar', 'Zierikzee'],
    'Belgium': ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Aalst', 'Mechelen', 'La Louvière', 'Kortrijk', 'Hasselt', 'Ostend', 'Sint-Niklaas', 'Tournai', 'Genk', 'Seraing', 'Roeselare', 'Verviers', 'Mouscron', 'Beveren', 'Dendermonde', 'Beringen', 'Turnhout', 'Dilbeek', 'Heist-op-den-Berg', 'Sint-Truiden', 'Lokeren', 'Geel', 'Brasschaat', 'Vilvoorde', 'Herstal', 'Maasmechelen', 'Waregem', 'Châtelet', 'Ieper', 'Ninove', 'Aarschot', 'Halle', 'Tienen', 'Lier', 'Schoten', 'Evergem', 'Grimbergen', 'Houthalen-Helchteren', 'Knokke-Heist', 'Mol', 'Ronse', 'Tongeren', 'Willebroek', 'Zaventem', 'Zottegem', 'Aartselaar', 'Asse', 'Beersel', 'Berchem', 'Berlaar', 'Berlare', 'Bertem', 'Bever', 'Bierbeek', 'Boechout', 'Bonheiden', 'Boom', 'Boortmeerbeek', 'Borgloon', 'Bornem', 'Borsbeek', 'Boutersem', 'Brasschaat', 'Brecht', 'Bredene', 'Bree', 'Brugge', 'Buggenhout', 'Damme', 'De Haan', 'De Panne', 'De Pinte', 'Deerlijk', 'Deinze', 'Denderleeuw', 'Dentergem', 'Dessel', 'Destelbergen', 'Deurne', 'Diegem', 'Diest', 'Diksmuide', 'Dilbeek', 'Dilsen-Stokkem', 'Drogenbos', 'Duffel', 'Edegem', 'Eeklo', 'Erpe-Mere', 'Evergem', 'Galmaarden', 'Gavere', 'Geel', 'Geetbets', 'Genk', 'Geraardsbergen', 'Gingelom', 'Gistel', 'Glabbeek', 'Gooik', 'Grimbergen', 'Grobbendonk', 'Haacht', 'Haaltert', 'Halen', 'Halle', 'Ham', 'Hamme', 'Hamont-Achel', 'Harelbeke', 'Hasselt', 'Hechtel-Eksel', 'Heers', 'Heist-op-den-Berg', 'Hemiksem', 'Herent', 'Herentals', 'Herenthout', 'Herk-de-Stad', 'Herne', 'Herselt', 'Herzele', 'Heusden-Zolder', 'Heuvelland', 'Hoegaarden', 'Hoeilaart', 'Hoeselt', 'Holsbeek', 'Hooglede', 'Hoogstraten', 'Horebeke', 'Houthalen-Helchteren', 'Houthulst', 'Hove', 'Huldenberg', 'Hulshout', 'Ichtegem', 'Ieper', 'Ingelmunster', 'Ittre', 'Izegem', 'Jabbeke', 'Jette', 'Jodoigne', 'Juprelle', 'Kalmthout', 'Kampenhout', 'Kapellen', 'Kapelle-op-den-Bos', 'Kaprijke', 'Kasterlee', 'Keerbergen', 'Kinrooi', 'Kluisbergen', 'Knesselare', 'Knokke-Heist', 'Koekelare', 'Koksijde', 'Kontich', 'Kortemark', 'Kortenaken', 'Kortenberg', 'Kortessem', 'Kortrijk', 'Kraainem', 'Kruibeke', 'Kruishoutem', 'Kuurne', 'Laakdal', 'Laarne', 'Lanaken', 'Landen', 'Langemark-Poelkapelle', 'Lebbeke', 'Lede', 'Lededegem', 'Lendelede', 'Lennik', 'Leopoldsburg', 'Lessines', 'Leuven', 'Lichtervelde', 'Liedekerke', 'Lier', 'Lierde', 'Lille', 'Linkebeek', 'Lint', 'Linter', 'Lo-Reninge', 'Lochristi', 'Lokeren', 'Lommel', 'Londerzeel', 'Lontzen', 'Lovendegem', 'Lubbeek', 'Lummen', 'Maarkedal', 'Maaseik', 'Maasmechelen', 'Machelen', 'Maldegem', 'Malle', 'Malmedy', 'Manage', 'Manhay', 'Marche-en-Famenne', 'Marcinelle', 'Mariakerke', 'Marneffe', 'Martelange', 'Mechelen', 'Meerhout', 'Meise', 'Meix-devant-Virton', 'Melle', 'Menen', 'Merchtem', 'Merkem', 'Merksplas', 'Mesen', 'Messancy', 'Mettet', 'Meulebeke', 'Middelkerke', 'Moerbeke', 'Mol', 'Momignies', 'Monceau-sur-Sambre', 'Monstreux', 'Mont-de-l\'Enclus', 'Mont-Saint-Guibert', 'Montignies-sur-Sambre', 'Montigny-le-Tilleul', 'Moorslede', 'Morlanwelz', 'Mortsel', 'Mouscron', 'Musson', 'Namur', 'Nandrin', 'Nassogne', 'Nazareth', 'Neerpelt', 'Neufchâteau', 'Nevele', 'Niel', 'Nieuwpoort', 'Nijlen', 'Ninove', 'Nivelles', 'Olen', 'Oostduinkerke', 'Oostende', 'Oosterzele', 'Oostkamp', 'Oostrozebeke', 'Opglabbeek', 'Opwijk', 'Oreye', 'Orp-Jauche', 'Ostend', 'Oud-Heverlee', 'Oud-Turnhout', 'Oudenaarde', 'Oudenburg', 'Oudergem', 'Overijse', 'Overpelt', 'Paal', 'Pepingen', 'Péruwelz', 'Pittem', 'Plombières', 'Poelkapelle', 'Poperinge', 'Profondeville', 'Putte', 'Puurs', 'Quaregnon', 'Quiévrain', 'Raeren', 'Ramillies', 'Ranst', 'Ravels', 'Rebecq', 'Rekem', 'Remicourt', 'Rendeux', 'Retie', 'Riemst', 'Rijkevorsel', 'Roeselare', 'Ronse', 'Roosdaal', 'Rotselaar', 'Rouvroy', 'Ruiselede', 'Rumst', 'Runkel', 'Rupelmonde', 'Saint-Ghislain', 'Saint-Hubert', 'Saint-Josse-ten-Noode', 'Saint-Nicolas', 'Sainte-Ode', 'Sambreville', 'Schaerbeek', 'Schelle', 'Scherpenheuvel-Zichem', 'Schilde', 'Schoten', 'Seneffe', 'Seraing', 'Sint-Amands', 'Sint-Genesius-Rode', 'Sint-Gillis-Waas', 'Sint-Jans-Molenbeek', 'Sint-Joost-ten-Node', 'Sint-Katelijne-Waver', 'Sint-Lambrechts-Woluwe', 'Sint-Laureins', 'Sint-Lievens-Houtem', 'Sint-Martens-Latem', 'Sint-Martens-Lierde', 'Sint-Niklaas', 'Sint-Pieters-Leeuw', 'Sint-Pieters-Woluwe', 'Sint-Truiden', 'Sivry-Rance', 'Soignies', 'Sombreffe', 'Somme-Leuze', 'Soumagne', 'Spa', 'Spiere-Helkijn', 'Stabroek', 'Staden', 'Steenokkerzeel', 'Stekene', 'Stoumont', 'Temse', 'Ternat', 'Tervuren', 'Tessenderlo', 'Theux', 'Thimister-Clermont', 'Thuin', 'Tielt', 'Tielt-Winge', 'Tienen', 'Tintigny', 'Tongeren', 'Torhout', 'Tournai', 'Tremelo', 'Trois-Ponts', 'Trooz', 'Tubize', 'Turnhout', 'Uccle', 'Uikhoven', 'Uitbergen', 'Ukkel', 'Ursel', 'Vaux-sur-Sûre', 'Verviers', 'Veurne', 'Vielsalm', 'Vilvoorde', 'Viroinval', 'Virton', 'Vise', 'Vleteren', 'Voeren', 'Vorselaar', 'Vosselaar', 'Vresse-sur-Semois', 'Waarschoot', 'Waasmunster', 'Wachtebeke', 'Wadrilmont', 'Waha', 'Walcourt', 'Walhain', 'Wanze', 'Waremme', 'Warneton', 'Warquignies', 'Wasseiges', 'Waterloo', 'Wavre', 'Welkenraedt', 'Wemmel', 'Wervik', 'Westerlo', 'Westmalle', 'Westmeerbeek', 'Wetteren', 'Wevelgem', 'Wezembeek-Oppem', 'Wichelen', 'Wielsbeke', 'Wijnegem', 'Willebroek', 'Wingene', 'Wommelgem', 'Wortegem-Petegem', 'Wuustwezel', 'Yvoir', 'Zandhoven', 'Zaventem', 'Zedelgem', 'Zeebrugge', 'Zele', 'Zelzate', 'Zemst', 'Zingem', 'Zoersel', 'Zomergem', 'Zonhoven', 'Zonnebeke', 'Zottegem', 'Zoutleeuw', 'Zuienkerke', 'Zulte', 'Zutendaal', 'Zwalm', 'Zwevegem', 'Zwijndrecht'],
    'Switzerland': ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Winterthur', 'St. Gallen', 'Lucerne', 'Lugano', 'Biel', 'Thun', 'Köniz', 'La Chaux-de-Fonds', 'Schaffhausen', 'Fribourg', 'Chur', 'Neuchâtel', 'Vernier', 'Uster', 'Sion', 'Lancy', 'Yverdon-les-Bains', 'Zug', 'Rapperswil-Jona', 'Dübendorf', 'Dietikon', 'Montreux', 'Frauenfeld', 'Wil', 'Kreuzlingen', 'Wetzikon', 'Carouge', 'Riehen', 'Allschwil', 'Baden', 'Meyrin', 'Onex', 'Vevey', 'Renens', 'Nyon', 'Aarau', 'Solothurn', 'Herisau', 'Appenzell', 'Glarus', 'Schwyz', 'Altdorf', 'Zug', 'Liestal', 'Sarnen', 'Stans', 'Frauenfeld', 'Aarau', 'Herisau', 'Appenzell', 'Glarus', 'Schwyz', 'Altdorf', 'Zug', 'Liestal', 'Sarnen', 'Stans', 'Frauenfeld'],
    'Austria': ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn', 'Steyr', 'Wiener Neustadt', 'Feldkirch', 'Bregenz', 'Leonding', 'Klosterneuburg', 'Baden', 'Wolfsberg', 'Leoben', 'Krems', 'Traun', 'Amstetten', 'Kapfenberg', 'Hallein', 'Kufstein', 'Traiskirchen', 'Schwechat', 'Braunau am Inn', 'Stockerau', 'Saalfelden', 'Ansfelden', 'Tulln', 'Hohenems', 'Spittal an der Drau', 'Ternitz', 'Telfs', 'Ternitz', 'Eisenstadt', 'Gmunden', 'Bludenz', 'Bad Ischl', 'Knittelfeld', 'Vöcklabruck', 'Waidhofen an der Ybbs', 'Schwaz', 'Lienz', 'Zell am See', 'Sankt Veit an der Glan', 'Gmünd', 'Oberwart', 'Judenburg', 'Bischofshofen', 'Neunkirchen', 'Gänserndorf', 'Mistelbach', 'Korneuburg', 'Bruck an der Mur', 'Freistadt', 'Kirchdorf an der Krems', 'Scheibbs', 'Zwettl', 'Horn', 'Melk', 'Perg', 'Rohrbach', 'Urfahr-Umgebung', 'Freistadt', 'Perg', 'Rohrbach', 'Urfahr-Umgebung', 'Freistadt', 'Perg', 'Rohrbach', 'Urfahr-Umgebung'],
    'Poland': ['Warsaw', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Bydgoszcz', 'Lublin', 'Katowice', 'Białystok', 'Gdynia', 'Częstochowa', 'Radom', 'Sosnowiec', 'Toruń', 'Kielce', 'Gliwice', 'Zabrze', 'Bytom', 'Olsztyn', 'Bielsko-Biała', 'Rzeszów', 'Ruda Śląska', 'Rybnik', 'Tychy', 'Dąbrowa Górnicza', 'Płock', 'Elbląg', 'Opole', 'Gorzów Wielkopolski', 'Wałbrzych', 'Zielona Góra', 'Włocławek', 'Tarnów', 'Chorzów', 'Kalisz', 'Koszalin', 'Legnica', 'Grudziądz', 'Słupsk', 'Jaworzno', 'Jastrzębie-Zdrój', 'Jelenia Góra', 'Nowy Sącz', 'Jędrzejów', 'Konin', 'Piotrków Trybunalski', 'Lubin', 'Ostrołęka', 'Stargard', 'Mysłowice', 'Piekary Śląskie', 'Głogów', 'Chełm', 'Zamość', 'Tomaszów Mazowiecki', 'Przemyśl', 'Stalowa Wola', 'Mielec', 'Łomża', 'Żory', 'Tarnowskie Góry', 'Bełchatów', 'Kędzierzyn-Koźle', 'Racibórz', 'Świętochłowice', 'Zawiercie', 'Żywiec', 'Oława', 'Brzeg', 'Nysa', 'Kłodzko', 'Świdnica', 'Jawor', 'Bolesławiec', 'Lubin', 'Głogów', 'Legnica', 'Złotoryja', 'Chojnów', 'Lwówek Śląski', 'Bolesławiec', 'Zgorzelec', 'Lubań', 'Kamienna Góra', 'Jelenia Góra', 'Karpacz', 'Szklarska Poręba', 'Świeradów-Zdrój', 'Kowary', 'Piechowice', 'Podgórzyn', 'Sobieszów', 'Cieplice Śląskie-Zdrój', 'Szczawno-Zdrój', 'Jedlina-Zdrój', 'Duszniki-Zdrój', 'Kudowa-Zdrój', 'Polanica-Zdrój', 'Lądek-Zdrój', 'Długopole-Zdrój', 'Międzygórze', 'Bystrzyca Kłodzka', 'Międzylesie', 'Stronie Śląskie', 'Lądek-Zdrój', 'Długopole-Zdrój', 'Międzygórze', 'Bystrzyca Kłodzka', 'Międzylesie', 'Stronie Śląskie'],
    'Portugal': ['Lisbon', 'Porto', 'Vila Nova de Gaia', 'Amadora', 'Braga', 'Funchal', 'Coimbra', 'Setúbal', 'Almada', 'Agualva-Cacém', 'Queluz', 'Rio de Mouro', 'Barreiro', 'Montijo', 'Amora', 'Corroios', 'Seixal', 'Odivelas', 'Leiria', 'Faro', 'Évora', 'Aveiro', 'Viseu', 'Guimarães', 'Matosinhos', 'Gondomar', 'Valongo', 'Vila do Conde', 'Póvoa de Varzim', 'Maia', 'Vila Nova de Famalicão', 'Felgueiras', 'Lousada', 'Paços de Ferreira', 'Santo Tirso', 'Trofa', 'Arouca', 'Espinho', 'Ovar', 'Oliveira de Azeméis', 'São João da Madeira', 'Vale de Cambra', 'Águeda', 'Mealhada', 'Anadia', 'Murtosa', 'Estarreja', 'Ílhavo', 'Vagos', 'Sever do Vouga', 'Albergaria-a-Velha', 'Oliveira do Bairro', 'Vagos', 'Sever do Vouga', 'Albergaria-a-Velha', 'Oliveira do Bairro'],
    'Greece': ['Athens', 'Thessaloniki', 'Patras', 'Piraeus', 'Larissa', 'Heraklion', 'Peristeri', 'Kallithea', 'Acharnes', 'Kalamaria', 'Nikaia', 'Glyfada', 'Volos', 'Ilio', 'Ilioupoli', 'Keratsini', 'Evosmos', 'Chalandri', 'Nea Smyrni', 'Marousi', 'Agios Dimitrios', 'Zografou', 'Egaleo', 'Nea Ionia', 'Ioannina', 'Palaio Faliro', 'Korydallos', 'Trikala', 'Chania', 'Chalcis', 'Petroupoli', 'Serres', 'Alexandroupoli', 'Xanthi', 'Katerini', 'Kalamata', 'Kavala', 'Lamia', 'Komotini', 'Rhodes', 'Drama', 'Veria', 'Kozani', 'Agrinio', 'Karditsa', 'Rethymno', 'Polygyros', 'Tripoli', 'Sparta', 'Livadeia', 'Amfissa', 'Lamia', 'Karpenisi', 'Agrinio', 'Mesolongi', 'Nafpaktos', 'Aigio', 'Patras', 'Pyrgos', 'Amaliada', 'Zakynthos', 'Argostoli', 'Lixouri', 'Sami', 'Poros', 'Ithaki', 'Fiskardo', 'Assos', 'Agia Efthymia', 'Lixouri', 'Sami', 'Poros', 'Ithaki', 'Fiskardo', 'Assos', 'Agia Efthymia'],
    'Sweden': ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Södertälje', 'Eskilstuna', 'Halmstad', 'Växjö', 'Karlstad', 'Sundsvall', 'Östersund', 'Trollhättan', 'Luleå', 'Lidingö', 'Borlänge', 'Tumba', 'Kristianstad', 'Kalmar', 'Falun', 'Skövde', 'Uddevalla', 'Varberg', 'Härnösand', 'Örnsköldsvik', 'Motala', 'Nyköping', 'Karlskrona', 'Landskrona', 'Mölndal', 'Piteå', 'Kungsbacka', 'Ljungby', 'Hudiksvall', 'Västervik', 'Trelleborg', 'Ystad', 'Hässleholm', 'Eslöv', 'Trelleborg', 'Ystad', 'Hässleholm', 'Eslöv'],
    'Norway': ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Bærum', 'Kristiansand', 'Fredrikstad', 'Tromsø', 'Sandnes', 'Asker', 'Skien', 'Ålesund', 'Sandefjord', 'Haugesund', 'Tønsberg', 'Moss', 'Porsgrunn', 'Bodø', 'Arendal', 'Hamar', 'Ytrebygda', 'Larvik', 'Halden', 'Lillehammer', 'Horten', 'Harstad', 'Molde', 'Kongsberg', 'Gjøvik', 'Hønefoss', 'Steinkjer', 'Narvik', 'Elverum', 'Kongsvinger', 'Notodden', 'Volda', 'Førde', 'Mo i Rana', 'Alta', 'Kirkenes', 'Honningsvåg', 'Vardø', 'Vadsø', 'Hammerfest', 'Tromsø', 'Harstad', 'Narvik', 'Bodø', 'Mo i Rana', 'Brønnøysund', 'Sandnessjøen', 'Mosjøen', 'Mo i Rana', 'Fauske', 'Narvik', 'Harstad', 'Tromsø', 'Alta', 'Hammerfest', 'Vardø', 'Vadsø', 'Kirkenes', 'Honningsvåg'],
    'Denmark': ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg', 'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde', 'Herning', 'Helsingør', 'Hørsholm', 'Silkeborg', 'Næstved', 'Fredericia', 'Viborg', 'Køge', 'Holstebro', 'Taastrup', 'Slagelse', 'Hillerød', 'Sønderborg', 'Svendborg', 'Holbæk', 'Hjørring', 'Frederikshavn', 'Nørresundby', 'Ringsted', 'Haderslev', 'Skive', 'Nyborg', 'Nykøbing Falster', 'Løgstør', 'Middelfart', 'Skanderborg', 'Nakskov', 'Rønne', 'Maribo', 'Nykøbing Mors', 'Thisted', 'Varde', 'Frederikssund', 'Kalundborg', 'Korsør', 'Nykøbing Sjælland', 'Præstø', 'Store Heddinge', 'Stege', 'Vordingborg', 'Næstved', 'Ringsted', 'Sorø', 'Slagelse', 'Korsør', 'Kalundborg', 'Holbæk', 'Roskilde', 'Hillerød', 'Frederikssund', 'Helsingør', 'Hørsholm', 'Lyngby-Taarbæk', 'Gentofte', 'Gladsaxe', 'Rødovre', 'Brøndby', 'Hvidovre', 'Ishøj', 'Vallensbæk', 'Tårnby', 'Dragør', 'Kastrup', 'Amager', 'Christianshavn', 'Nyhavn', 'Strøget', 'Tivoli', 'Rosenborg', 'Amalienborg', 'Kongens Nytorv', 'Nyhavn', 'Strøget', 'Tivoli', 'Rosenborg', 'Amalienborg', 'Kongens Nytorv'],
    'Finland': ['Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku', 'Jyväskylä', 'Lahti', 'Kuopio', 'Pori', 'Kouvola', 'Joensuu', 'Lappeenranta', 'Hämeenlinna', 'Vaasa', 'Seinäjoki', 'Rovaniemi', 'Mikkeli', 'Kotka', 'Salo', 'Porvoo', 'Lohja', 'Hyvinkää', 'Järvenpää', 'Nurmijärvi', 'Rauma', 'Kokkola', 'Kajaani', 'Raahe', 'Ylivieska', 'Kemi', 'Tornio', 'Kemijärvi', 'Sodankylä', 'Inari', 'Utsjoki', 'Nuorgam', 'Kevo', 'Kilpisjärvi', 'Enontekiö', 'Muonio', 'Kittilä', 'Levi', 'Ylläs', 'Ruka', 'Kuusamo', 'Suomussalmi', 'Kuhmo', 'Lieksa', 'Nurmes', 'Juuka', 'Kitee', 'Tohmajärvi', 'Ilomantsi', 'Joensuu', 'Kontiolahti', 'Outokumpu', 'Polvijärvi', 'Liperi', 'Rääkkylä', 'Kitee', 'Tohmajärvi', 'Ilomantsi', 'Joensuu', 'Kontiolahti', 'Outokumpu', 'Polvijärvi', 'Liperi', 'Rääkkylä']
  };

  const regions = fallbackData[countryName] || [];
  return regions.map(name => ({ name }));
}

/**
 * Fallback cities when API is not available
 */
function getFallbackCities(regionName: string): LocationResult[] {
  const commonCities: Record<string, string[]> = {
    // Ireland - All Counties
    'Dublin': ['Dublin City', 'Finglas', 'Ballymun', 'Cabra', 'Phibsborough', 'Drumcondra', 'Glasnevin', 'Coolock', 'Raheny', 'Clontarf', 'Howth'],
    'Cork': ['Cork City', 'Cobh', 'Midleton', 'Youghal', 'Kinsale', 'Blarney', 'Fermoy', 'Mallow', 'Bandon', 'Skibbereen'],
    'Galway': ['Galway City', 'Tuam', 'Ballinasloe', 'Loughrea', 'Athenry', 'Gort', 'Clifden', 'Oughterard', 'Portumna', 'Headford'],
    'Limerick': ['Limerick City', 'Newcastle West', 'Kilmallock', 'Rathkeale', 'Abbeyfeale', 'Askeaton', 'Foynes', 'Adare', 'Patrickswell', 'Castletroy'],
    'Waterford': ['Waterford City', 'Dungarvan', 'Tramore', 'Lismore', 'Portlaw', 'Kilmacthomas', 'Dunmore East', 'Ardmore', 'Cappoquin', 'Tallow'],
    'Kilkenny': ['Kilkenny City', 'Callan', 'Thomastown', 'Castlecomer', 'Graiguenamanagh', 'Ballyragget', 'Freshford', 'Inistioge', 'Mullinavat', 'Urlingford'],
    'Sligo': ['Sligo Town', 'Ballymote', 'Tubbercurry', 'Strandhill', 'Enniscrone', 'Collooney', 'Ballysadare', 'Grange', 'Rosses Point', 'Dromore West'],
    'Donegal': ['Letterkenny', 'Ballybofey', 'Buncrana', 'Bundoran', 'Donegal Town', 'Dungloe', 'Carndonagh', 'Moville', 'Killybegs', 'Ballyshannon'],
    'Kerry': ['Tralee', 'Killarney', 'Listowel', 'Dingle', 'Kenmare', 'Cahersiveen', 'Castleisland', 'Killorglin', 'Millstreet', 'Ballybunion'],
    'Mayo': ['Castlebar', 'Ballina', 'Westport', 'Claremorris', 'Ballinrobe', 'Swinford', 'Kiltimagh', 'Ballyhaunis', 'Foxford', 'Belmullet'],
    'Clare': ['Ennis', 'Kilrush', 'Shannon', 'Kilkee', 'Lahinch', 'Newmarket-on-Fergus', 'Ennistymon', 'Scariff', 'Tulla', 'Sixmilebridge'],
    'Tipperary': ['Clonmel', 'Nenagh', 'Thurles', 'Carrick-on-Suir', 'Roscrea', 'Cahir', 'Cashel', 'Templemore', 'Tipperary Town', 'Fethard'],
    'Wexford': ['Wexford Town', 'Enniscorthy', 'New Ross', 'Gorey', 'Bunclody', 'Courtown', 'Rosslare', 'Kilmore Quay', 'Fethard-on-Sea', 'Taghmon'],
    'Wicklow': ['Wicklow Town', 'Bray', 'Greystones', 'Arklow', 'Blessington', 'Rathnew', 'Newtownmountkennedy', 'Baltinglass', 'Aughrim', 'Rathdrum'],
    'Meath': ['Navan', 'Trim', 'Kells', 'Drogheda', 'Ashbourne', 'Dunboyne', 'Ratoath', 'Slane', 'Oldcastle', 'Laytown'],
    'Louth': ['Dundalk', 'Drogheda', 'Ardee', 'Dunleer', 'Carlingford', 'Termonfeckin', 'Blackrock', 'Omeath', 'Castlebellingham', 'Clogherhead'],
    'Kildare': ['Naas', 'Newbridge', 'Athy', 'Leixlip', 'Celbridge', 'Maynooth', 'Kildare Town', 'Monasterevin', 'Kilcock', 'Clane'],
    'Carlow': ['Carlow Town', 'Tullow', 'Muine Bheag', 'Bagenalstown', 'Rathvilly', 'Borris', 'Leighlinbridge', 'Hacketstown', 'Ballon', 'Clonegal'],
    'Laois': ['Portlaoise', 'Mountmellick', 'Portarlington', 'Abbeyleix', 'Mountrath', 'Stradbally', 'Durrow', 'Rathdowney', 'Ballylinan', 'Ballinakill'],
    'Offaly': ['Tullamore', 'Birr', 'Edenderry', 'Banagher', 'Clara', 'Ferbane', 'Kilcormac', 'Daingean', 'Shinrone', 'Kinnitty'],
    'Westmeath': ['Mullingar', 'Athlone', 'Moate', 'Kilbeggan', 'Castlepollard', 'Delvin', 'Rochfortbridge', 'Ballymahon', 'Ballinahown', 'Ballymore'],
    'Longford': ['Longford Town', 'Ballymahon', 'Edgeworthstown', 'Granard', 'Newtownforbes', 'Lanesborough', 'Ballynacargy', 'Drumlish', 'Killashee', 'Ardagh'],
    'Roscommon': ['Roscommon Town', 'Boyle', 'Castlerea', 'Ballaghaderreen', 'Strokestown', 'Elphin', 'Monksland', 'Athlone', 'Tulsk', 'Frenchpark'],
    'Leitrim': ['Carrick-on-Shannon', 'Manorhamilton', 'Ballinamore', 'Mohill', 'Drumshanbo', 'Kinlough', 'Dromahair', 'Carrigallen', 'Rossinver', 'Tullaghan'],
    'Cavan': ['Cavan Town', 'Belturbet', 'Cootehill', 'Ballyjamesduff', 'Virginia', 'Kingscourt', 'Bailieborough', 'Mullagh', 'Shercock', 'Arvagh'],
    'Monaghan': ['Monaghan Town', 'Carrickmacross', 'Castleblayney', 'Clones', 'Ballybay', 'Emyvale', 'Scotstown', 'Newbliss', 'Rockcorry', 'Smithborough'],
    
    // USA - All States
    'Alabama': ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa', 'Hoover', 'Dothan', 'Auburn', 'Decatur', 'Madison'],
    'Alaska': ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan', 'Wasilla', 'Kenai', 'Kodiak', 'Bethel', 'Palmer'],
    'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe', 'Peoria', 'Surprise'],
    'Arkansas': ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro', 'North Little Rock', 'Conway', 'Rogers', 'Pine Bluff', 'Bentonville'],
    'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont'],
    'Colorado': ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Centennial'],
    'Connecticut': ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'West Hartford', 'Greenwich'],
    'Delaware': ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna', 'Milford', 'Seaford', 'Georgetown', 'Elsmere', 'New Castle'],
    'Florida': ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'Tallahassee', 'St. Petersburg', 'Hialeah', 'Port St. Lucie', 'Cape Coral'],
    'Georgia': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Macon', 'Johns Creek', 'Albany'],
    'Hawaii': ['Honolulu', 'Hilo', 'Kailua', 'Kaneohe', 'Pearl City', 'Waipahu', 'Kahului', 'Ewa Beach', 'Mililani', 'Kihei'],
    'Idaho': ['Boise', 'Nampa', 'Meridian', 'Idaho Falls', 'Pocatello', 'Caldwell', 'Coeur d\'Alene', 'Twin Falls', 'Lewiston', 'Post Falls'],
    'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Elgin', 'Peoria', 'Champaign', 'Waukegan', 'Cicero'],
    'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington', 'Hammond', 'Gary', 'Muncie'],
    'Iowa': ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Council Bluffs', 'Ames', 'West Des Moines', 'Dubuque'],
    'Kansas': ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka', 'Lawrence', 'Shawnee', 'Manhattan', 'Lenexa', 'Salina'],
    'Kentucky': ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Hopkinsville', 'Richmond', 'Florence', 'Georgetown', 'Henderson'],
    'Louisiana': ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles', 'Kenner', 'Bossier City', 'Monroe', 'Alexandria', 'Houma'],
    'Maine': ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn', 'Biddeford', 'Sanford', 'Saco', 'Augusta', 'Westbrook'],
    'Maryland': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Annapolis', 'College Park', 'Salisbury', 'Laurel', 'Greenbelt'],
    'Massachusetts': ['Boston', 'Worcester', 'Springfield', 'Lowell', 'Cambridge', 'New Bedford', 'Brockton', 'Quincy', 'Lynn', 'Fall River'],
    'Michigan': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Lansing', 'Ann Arbor', 'Flint', 'Dearborn', 'Livonia', 'Troy'],
    'Minnesota': ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'St. Cloud', 'Eagan', 'Woodbury'],
    'Mississippi': ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi', 'Meridian', 'Tupelo', 'Greenville', 'Olive Branch', 'Horn Lake'],
    'Missouri': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph', 'St. Charles', 'St. Peters'],
    'Montana': ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte', 'Helena', 'Kalispell', 'Havre', 'Anaconda', 'Miles City'],
    'Nebraska': ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney', 'Fremont', 'Hastings', 'North Platte', 'Norfolk', 'Columbus'],
    'Nevada': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City', 'Fernley', 'Elko', 'Mesquite', 'Boulder City'],
    'New Hampshire': ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester', 'Dover', 'Salem', 'Merrimack', 'Londonderry', 'Hudson'],
    'New Jersey': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge', 'Lakewood', 'Toms River', 'Hamilton', 'Trenton'],
    'New Mexico': ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell', 'Farmington', 'Clovis', 'Hobbs', 'Alamogordo', 'Carlsbad'],
    'New York': ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers', 'Utica', 'White Plains', 'Troy', 'Binghamton'],
    'North Carolina': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord'],
    'North Dakota': ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo', 'Williston', 'Dickinson', 'Mandan', 'Jamestown', 'Wahpeton'],
    'Ohio': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain'],
    'Oklahoma': ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton', 'Edmond', 'Moore', 'Midwest City', 'Enid', 'Stillwater'],
    'Oregon': ['Portland', 'Eugene', 'Salem', 'Gresham', 'Hillsboro', 'Bend', 'Beaverton', 'Medford', 'Springfield', 'Corvallis'],
    'Pennsylvania': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona'],
    'Rhode Island': ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence', 'Woonsocket', 'Newport', 'Central Falls', 'Westerly', 'Cumberland'],
    'South Carolina': ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill', 'Greenville', 'Summerville', 'Sumter', 'Hilton Head Island', 'Spartanburg'],
    'South Dakota': ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown', 'Mitchell', 'Yankton', 'Pierre', 'Huron', 'Vermillion'],
    'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City', 'Bartlett'],
    'Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie'],
    'Utah': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George', 'Layton', 'Taylorsville'],
    'Vermont': ['Burlington', 'Essex', 'South Burlington', 'Colchester', 'Montpelier', 'Rutland', 'Barre', 'St. Albans', 'Brattleboro', 'Milton'],
    'Virginia': ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton', 'Portsmouth', 'Suffolk', 'Roanoke'],
    'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett', 'Renton', 'Yakima', 'Federal Way'],
    'West Virginia': ['Charleston', 'Huntington', 'Parkersburg', 'Morgantown', 'Wheeling', 'Martinsburg', 'Fairmont', 'Beckley', 'Clarksburg', 'South Charleston'],
    'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Oshkosh', 'Eau Claire', 'Janesville'],
    'Wyoming': ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs', 'Sheridan', 'Green River', 'Evanston', 'Riverton', 'Jackson'],
    
    // UK
    'England': ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Leicester', 'Coventry', 'Nottingham'],
    'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Perth', 'Stirling', 'Ayr', 'Dumfries', 'Falkirk'],
    'Wales': ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Barry', 'Caerphilly', 'Rhondda', 'Merthyr Tydfil', 'Bridgend', 'Aberystwyth'],
    'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Bangor', 'Craigavon', 'Castlereagh', 'Carrickfergus', 'Newtownabbey', 'Coleraine'],
    
    // Canada - All Provinces/Territories
    'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Fort McMurray'],
    'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Langley', 'Nanaimo'],
    'Manitoba': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie', 'Winkler', 'Selkirk', 'Dauphin', 'Morden', 'Flin Flon'],
    'New Brunswick': ['Saint John', 'Moncton', 'Fredericton', 'Dieppe', 'Miramichi', 'Edmundston', 'Riverview', 'Quispamsis', 'Bathurst', 'Campbellton'],
    'Newfoundland and Labrador': ['St. John\'s', 'Mount Pearl', 'Corner Brook', 'Conception Bay South', 'Grand Falls-Windsor', 'Gander', 'Happy Valley-Goose Bay', 'Labrador City', 'Stephenville', 'Marystown'],
    'Northwest Territories': ['Yellowknife', 'Hay River', 'Inuvik', 'Fort Smith', 'Behchokǫ̀', 'Fort Simpson', 'Tuktoyaktuk', 'Norman Wells', 'Fort McPherson', 'Aklavik'],
    'Nova Scotia': ['Halifax', 'Dartmouth', 'Sydney', 'Truro', 'New Glasgow', 'Glace Bay', 'Kentville', 'Amherst', 'Bridgewater', 'Yarmouth'],
    'Nunavut': ['Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay', 'Igloolik', 'Pangnirtung', 'Pond Inlet', 'Cape Dorset', 'Kugluktuk'],
    'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor'],
    'Prince Edward Island': ['Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague', 'Kensington', 'Souris', 'Alberton', 'Tignish', 'Georgetown'],
    'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Lévis', 'Trois-Rivières', 'Terrebonne'],
    'Saskatchewan': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster'],
    'Yukon': ['Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction', 'Carmacks', 'Mayo', 'Faro', 'Teslin', 'Ross River', 'Old Crow'],
    
    // Australia - All States
    'New South Wales': ['Sydney', 'Newcastle', 'Wollongong', 'Albury', 'Wagga Wagga', 'Tamworth', 'Orange', 'Dubbo', 'Nowra', 'Broken Hill', 'Bathurst', 'Lismore', 'Coffs Harbour', 'Port Macquarie', 'Tweed Heads'],
    'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Warrnambool', 'Latrobe', 'Mildura', 'Horsham', 'Wodonga', 'Traralgon', 'Frankston', 'Dandenong', 'Ringwood', 'Pakenham'],
    'Queensland': ['Brisbane', 'Gold Coast', 'Cairns', 'Townsville', 'Toowoomba', 'Rockhampton', 'Mackay', 'Bundaberg', 'Hervey Bay', 'Gladstone', 'Sunshine Coast', 'Ipswich', 'Logan', 'Redcliffe', 'Mount Isa'],
    'Western Australia': ['Perth', 'Fremantle', 'Bunbury', 'Geraldton', 'Kalgoorlie', 'Albany', 'Broome', 'Mandurah', 'Rockingham', 'Joondalup', 'Busselton', 'Esperance', 'Port Hedland', 'Karratha', 'Exmouth'],
    'South Australia': ['Adelaide', 'Mount Gambier', 'Whyalla', 'Murray Bridge', 'Port Augusta', 'Port Pirie', 'Port Lincoln', 'Victor Harbor', 'Gawler', 'Millicent', 'Naracoorte', 'Kadina', 'Berri', 'Roxby Downs', 'Ceduna'],
    'Tasmania': ['Hobart', 'Launceston', 'Devonport', 'Burnie', 'Ulverstone', 'George Town', 'Queenstown', 'Scottsdale', 'Smithton', 'Currie', 'Strahan', 'St Helens', 'Swansea', 'Bicheno', 'Port Arthur'],
    'Northern Territory': ['Darwin', 'Alice Springs', 'Palmerston', 'Katherine', 'Nhulunbuy', 'Tennant Creek', 'Yulara', 'Casuarina', 'Humpty Doo', 'Batchelor'],
    'Australian Capital Territory': ['Canberra', 'Gungahlin', 'Tuggeranong', 'Belconnen', 'Weston Creek', 'Woden Valley', 'Inner North', 'Inner South'],
    
    // Germany - All States
    'Baden-Württemberg': ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg', 'Heilbronn', 'Ulm', 'Pforzheim', 'Reutlingen', 'Tübingen'],
    'Bavaria': ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg', 'Würzburg', 'Ingolstadt', 'Fürth', 'Erlangen', 'Bayreuth', 'Bamberg'],
    'Berlin': ['Berlin', 'Charlottenburg', 'Kreuzberg', 'Prenzlauer Berg', 'Friedrichshain', 'Mitte', 'Neukölln', 'Wedding', 'Schöneberg', 'Tempelhof'],
    'Brandenburg': ['Potsdam', 'Cottbus', 'Brandenburg', 'Frankfurt', 'Oranienburg', 'Falkensee', 'Eberswalde', 'Schwedt', 'Fürstenwalde', 'Königs Wusterhausen'],
    'Bremen': ['Bremen', 'Bremerhaven'],
    'Hamburg': ['Hamburg', 'Altona', 'Harburg', 'Eimsbüttel', 'Wandsbek', 'Bergedorf', 'Billstedt', 'Barmbek', 'Winterhude', 'Ottensen'],
    'Hesse': ['Frankfurt', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach', 'Hanau', 'Gießen', 'Marburg', 'Fulda', 'Rüsselsheim'],
    'Lower Saxony': ['Hanover', 'Braunschweig', 'Oldenburg', 'Osnabrück', 'Wolfsburg', 'Göttingen', 'Salzgitter', 'Hildesheim', 'Delmenhorst', 'Wilhelmshaven'],
    'Mecklenburg-Vorpommern': ['Rostock', 'Schwerin', 'Neubrandenburg', 'Stralsund', 'Greifswald', 'Wismar', 'Güstrow', 'Waren', 'Neustrelitz', 'Parchim'],
    'North Rhine-Westphalia': ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster'],
    'Rhineland-Palatinate': ['Mainz', 'Ludwigshafen', 'Koblenz', 'Trier', 'Kaiserslautern', 'Worms', 'Neuwied', 'Neustadt', 'Speyer', 'Frankenthal'],
    'Saarland': ['Saarbrücken', 'Neunkirchen', 'Homburg', 'Völklingen', 'Sankt Ingbert', 'Saarlouis', 'Merzig', 'St. Wendel', 'Blieskastel', 'Dillingen'],
    'Saxony': ['Dresden', 'Leipzig', 'Chemnitz', 'Zwickau', 'Plauen', 'Görlitz', 'Freiberg', 'Bautzen', 'Hoyerswerda', 'Pirna'],
    'Saxony-Anhalt': ['Magdeburg', 'Halle', 'Dessau', 'Wittenberg', 'Halberstadt', 'Stendal', 'Bitterfeld', 'Merseburg', 'Bernburg', 'Naumburg'],
    'Schleswig-Holstein': ['Kiel', 'Lübeck', 'Flensburg', 'Neumünster', 'Norderstedt', 'Elmshorn', 'Pinneberg', 'Itzehoe', 'Wedel', 'Ahrensburg'],
    'Thuringia': ['Erfurt', 'Jena', 'Gera', 'Weimar', 'Gotha', 'Eisenach', 'Nordhausen', 'Suhl', 'Altenburg', 'Mühlhausen'],
    
    // France - All Regions
    'Île-de-France': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Argenteuil', 'Montreuil', 'Nanterre', 'Créteil', 'Versailles', 'Courbevoie', 'Vitry-sur-Seine'],
    'Auvergne-Rhône-Alpes': ['Lyon', 'Grenoble', 'Saint-Étienne', 'Clermont-Ferrand', 'Villeurbanne', 'Annecy', 'Valence', 'Chambéry', 'Roanne', 'Bourg-en-Bresse'],
    'Provence-Alpes-Côte d\'Azur': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon', 'Cannes', 'Antibes', 'La Seyne-sur-Mer', 'Hyères', 'Fréjus'],
    'Nouvelle-Aquitaine': ['Bordeaux', 'Limoges', 'Poitiers', 'La Rochelle', 'Angoulême', 'Bayonne', 'Pau', 'Biarritz', 'Niort', 'Agen'],
    'Occitanie': ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers', 'Montauban', 'Albi', 'Carcassonne', 'Narbonne', 'Sète'],
    'Hauts-de-France': ['Lille', 'Amiens', 'Roubaix', 'Tourcoing', 'Dunkirk', 'Calais', 'Boulogne-sur-Mer', 'Valenciennes', 'Lens', 'Arras'],
    'Grand Est': ['Strasbourg', 'Reims', 'Metz', 'Nancy', 'Mulhouse', 'Colmar', 'Troyes', 'Charleville-Mézières', 'Châlons-en-Champagne', 'Épinal'],
    'Pays de la Loire': ['Nantes', 'Le Mans', 'Angers', 'Saint-Nazaire', 'La Roche-sur-Yon', 'Laval', 'Cholet', 'Saint-Herblain', 'Rezé', 'Saumur'],
    'Normandy': ['Rouen', 'Caen', 'Le Havre', 'Cherbourg', 'Évreux', 'Dieppe', 'Alençon', 'Saint-Lô', 'Lisieux', 'Vernon'],
    'Brittany': ['Rennes', 'Brest', 'Quimper', 'Lorient', 'Vannes', 'Saint-Malo', 'Saint-Brieuc', 'Lannion', 'Fouesnant', 'Concarneau'],
    'Bourgogne-Franche-Comté': ['Dijon', 'Besançon', 'Belfort', 'Chalon-sur-Saône', 'Auxerre', 'Mâcon', 'Nevers', 'Montbéliard', 'Vesoul', 'Sens'],
    'Centre-Val de Loire': ['Tours', 'Orléans', 'Bourges', 'Blois', 'Chartres', 'Châteauroux', 'Joué-lès-Tours', 'Vierzon', 'Dreux', 'Romorantin-Lanthenay'],
    'Corsica': ['Ajaccio', 'Bastia', 'Porto-Vecchio', 'Calvi', 'Bonifacio', 'Corte', 'Propriano', 'L\'Île-Rousse', 'Porto', 'Sartène'],
    
    // Spain - All Regions
    'Andalusia': ['Seville', 'Málaga', 'Córdoba', 'Granada', 'Jerez de la Frontera', 'Almería', 'Marbella', 'Cádiz', 'Huelva', 'Jaén'],
    'Aragon': ['Zaragoza', 'Huesca', 'Teruel', 'Calatayud', 'Jaca', 'Barbastro', 'Alcañiz', 'Monzón', 'Ejea de los Caballeros', 'Fraga'],
    'Asturias': ['Oviedo', 'Gijón', 'Avilés', 'Siero', 'Langreo', 'Mieres', 'Castrillón', 'San Martín del Rey Aurelio', 'Corvera de Asturias', 'Llanera'],
    'Balearic Islands': ['Palma', 'Calvià', 'Ibiza', 'Manacor', 'Llucmajor', 'Marratxí', 'Ciutadella', 'Mahón', 'Inca', 'Felanitx'],
    'Basque Country': ['Bilbao', 'Vitoria-Gasteiz', 'San Sebastián', 'Barakaldo', 'Getxo', 'Irun', 'Portugalete', 'Santurtzi', 'Basauri', 'Errenteria'],
    'Canary Islands': ['Las Palmas', 'Santa Cruz de Tenerife', 'San Cristóbal de La Laguna', 'Telde', 'Arona', 'Santa Lucía de Tirajana', 'Arrecife', 'San Bartolomé de Tirajana', 'La Orotava', 'Puerto del Rosario'],
    'Cantabria': ['Santander', 'Torrelavega', 'Castro-Urdiales', 'Camargo', 'Piélagos', 'El Astillero', 'Laredo', 'Santoña', 'Los Corrales de Buelna', 'Reinosa'],
    'Castile and León': ['Valladolid', 'Burgos', 'León', 'Salamanca', 'Zamora', 'Palencia', 'Ávila', 'Segovia', 'Soria', 'Ponferrada'],
    'Castile-La Mancha': ['Toledo', 'Albacete', 'Guadalajara', 'Ciudad Real', 'Cuenca', 'Talavera de la Reina', 'Puertollano', 'Tomelloso', 'Alcázar de San Juan', 'Valdepeñas'],
    'Catalonia': ['Barcelona', 'Badalona', 'Sabadell', 'Terrassa', 'Lleida', 'Tarragona', 'Mataró', 'Santa Coloma de Gramenet', 'Reus', 'Girona'],
    'Extremadura': ['Badajoz', 'Cáceres', 'Mérida', 'Plasencia', 'Don Benito', 'Almendralejo', 'Villanueva de la Serena', 'Navalmoral de la Mata', 'Zafra', 'Montijo'],
    'Galicia': ['Vigo', 'A Coruña', 'Ourense', 'Lugo', 'Santiago de Compostela', 'Pontevedra', 'Ferrol', 'Narón', 'Vilagarcía de Arousa', 'Monforte de Lemos'],
    'La Rioja': ['Logroño', 'Calahorra', 'Arnedo', 'Haro', 'Alfaro', 'Nájera', 'Santo Domingo de la Calzada', 'Lardero', 'Villamediana de Iregua', 'Fuenmayor'],
    'Madrid': ['Madrid', 'Móstoles', 'Alcalá de Henares', 'Fuenlabrada', 'Leganés', 'Getafe', 'Alcorcón', 'Torrejón de Ardoz', 'Parla', 'Alcobendas'],
    'Murcia': ['Murcia', 'Cartagena', 'Lorca', 'Molina de Segura', 'Alcantarilla', 'Cieza', 'Yecla', 'Caravaca de la Cruz', 'Totana', 'Mazarrón'],
    'Navarre': ['Pamplona', 'Tudela', 'Barañáin', 'Burlada', 'Estella-Lizarra', 'Tafalla', 'Villava', 'Ansoáin', 'Zizur Mayor', 'Alsasua'],
    'Valencia': ['Valencia', 'Alicante', 'Elche', 'Castellón de la Plana', 'Torrevieja', 'Orihuela', 'Gandia', 'Benidorm', 'Sagunto', 'Alcoy'],
    
    // New Zealand - All Regions
    'Auckland': ['Auckland', 'Manukau', 'North Shore', 'Waitakere', 'Papakura', 'Howick', 'Takapuna', 'Henderson', 'Glenfield', 'Albany'],
    'Bay of Plenty': ['Tauranga', 'Rotorua', 'Whakatane', 'Taupo', 'Opotiki', 'Kawerau', 'Te Puke', 'Mount Maunganui', 'Papamoa', 'Ohope'],
    'Canterbury': ['Christchurch', 'Timaru', 'Ashburton', 'Rangiora', 'Kaiapoi', 'Rolleston', 'Lincoln', 'Leeston', 'Darfield', 'Geraldine'],
    'Gisborne': ['Gisborne', 'Tolaga Bay', 'Te Karaka', 'Ruatoria', 'Manutuke', 'Matawai', 'Tokomaru Bay', 'Hicks Bay', 'Tiniroto', 'Whatatutu'],
    'Hawke\'s Bay': ['Napier', 'Hastings', 'Havelock North', 'Taradale', 'Flaxmere', 'Waipawa', 'Waipukurau', 'Wairoa', 'Dannevirke', 'Porangahau'],
    'Manawatu-Wanganui': ['Palmerston North', 'Whanganui', 'Levin', 'Feilding', 'Marton', 'Taihape', 'Foxton', 'Pahiatua', 'Ohakune', 'Raetihi'],
    'Marlborough': ['Blenheim', 'Picton', 'Kaikoura', 'Renwick', 'Seddon', 'Havelock', 'Ward', 'Spring Creek', 'Rai Valley', 'Kekerengu'],
    'Nelson': ['Nelson', 'Richmond', 'Motueka', 'Stoke', 'Tahunanui', 'Mapua', 'Wakefield', 'Brightwater', 'Murchison', 'Takaka'],
    'Northland': ['Whangarei', 'Dargaville', 'Kaitaia', 'Kerikeri', 'Kaikohe', 'Paihia', 'Ruakaka', 'Mangawhai', 'Warkworth', 'Wellsford'],
    'Otago': ['Dunedin', 'Queenstown', 'Wanaka', 'Oamaru', 'Alexandra', 'Cromwell', 'Balclutha', 'Milton', 'Arrowtown', 'Lawrence'],
    'Southland': ['Invercargill', 'Gore', 'Te Anau', 'Bluff', 'Winton', 'Riverton', 'Mataura', 'Edendale', 'Wyndham', 'Lumsden'],
    'Taranaki': ['New Plymouth', 'Hawera', 'Stratford', 'Waitara', 'Inglewood', 'Eltham', 'Opunake', 'Patea', 'Mokau', 'Urenui'],
    'Tasman': ['Richmond', 'Motueka', 'Takaka', 'Mapua', 'Wakefield', 'Brightwater', 'Murchison', 'Collingwood', 'Kaiteriteri', 'Riwaka'],
    'Waikato': ['Hamilton', 'Cambridge', 'Taupo', 'Tokoroa', 'Te Awamutu', 'Huntly', 'Matamata', 'Morrinsville', 'Thames', 'Paeroa'],
    'Wellington': ['Wellington', 'Lower Hutt', 'Upper Hutt', 'Porirua', 'Kapiti', 'Masterton', 'Carterton', 'Featherston', 'Greytown', 'Martinborough'],
    'West Coast': ['Greymouth', 'Westport', 'Hokitika', 'Reefton', 'Runanga', 'Brunner', 'Kumara', 'Franz Josef', 'Fox Glacier', 'Haast'],
    
    // Northern Ireland - Counties (treated as regions when selected as country)
    'Antrim': ['Belfast', 'Lisburn', 'Carrickfergus', 'Larne', 'Ballymena', 'Antrim', 'Newtownabbey', 'Carrickfergus', 'Ballyclare', 'Crumlin'],
    'Armagh': ['Armagh', 'Craigavon', 'Lurgan', 'Portadown', 'Banbridge', 'Newry', 'Tandragee', 'Markethill', 'Keady', 'Crossmaglen'],
    'Down': ['Newry', 'Downpatrick', 'Banbridge', 'Newcastle', 'Warrenpoint', 'Kilkeel', 'Saintfield', 'Comber', 'Dundonald', 'Holywood'],
    'Fermanagh': ['Enniskillen', 'Lisnaskea', 'Irvinestown', 'Ballinamallard', 'Kesh', 'Belleek', 'Derrygonnelly', 'Tempo', 'Garrison', 'Florencecourt'],
    'Londonderry': ['Derry', 'Coleraine', 'Limavady', 'Magherafelt', 'Portstewart', 'Portrush', 'Dungiven', 'Castlerock', 'Kilrea', 'Bellaghy'],
    'Tyrone': ['Omagh', 'Strabane', 'Dungannon', 'Cookstown', 'Coalisland', 'Dromore', 'Fintona', 'Fivemiletown', 'Ballygawley', 'Clogher'],
    
    // Netherlands - Major Cities (treated as regions, with local areas/neighborhoods)
    'Amsterdam': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West', 'Nieuw-West', 'Zuidoost', 'Westpoort', 'Jordaan', 'De Pijp', 'Oud-Zuid', 'Oud-West'],
    'Rotterdam': ['Centrum', 'Charlois', 'Delfshaven', 'Feijenoord', 'Hillegersberg-Schiebroek', 'Hoek van Holland', 'Hoogvliet', 'IJsselmonde', 'Kralingen-Crooswijk', 'Noord', 'Overschie', 'Pernis', 'Prins Alexander', 'Rozenburg'],
    'The Hague': ['Centrum', 'Escamp', 'Haagse Hout', 'Laak', 'Leidschenveen-Ypenburg', 'Loosduinen', 'Scheveningen', 'Segbroek'],
    'Utrecht': ['Centrum', 'Binnenstad', 'Noordwest', 'Oost', 'Overvecht', 'Zuid', 'Zuidwest', 'Vleuten-De Meern', 'Leidsche Rijn', 'Lombok', 'Oog in Al', 'Wittevrouwen', 'Tuinwijk', 'Zuilen', 'Ondiep', 'Pijlsweerd', 'Wittevrouwensingel', 'Biltsche Grift', 'Rivierenwijk', 'Transwijk', 'Hoograven', 'Tolsteeg', 'Rotsoord', 'Lunetten', 'Kanaleneiland', 'Nieuwegein-Noord', 'Nieuwegein-Zuid', 'Vreeswijk', 'Jutphaas', 'Galecop', 'Hekendorp', 'Oudewater', 'Haastrecht', 'Gouda-Zuid', 'Gouda-Noord', 'Gouda-Centrum'],
    'Eindhoven': ['Centrum', 'Woensel-Noord', 'Woensel-Zuid', 'Stratum', 'Gestel', 'Strijp'],
    'Groningen': ['Centrum', 'Oost', 'West', 'Noord', 'Zuid', 'Helpman', 'Paddepoel'],
    'Tilburg': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West', 'Reeshof'],
    'Almere': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West', 'Haven', 'Buiten'],
    'Breda': ['Centrum', 'Ginneken', 'Prinsenbeek', 'Teteringen', 'Ulvenhout'],
    'Nijmegen': ['Centrum', 'Nijmegen-Oost', 'Nijmegen-Zuid', 'Nijmegen-Noord', 'Dukenburg', 'Lindenholt'],
    'Enschede': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Haarlem': ['Centrum', 'Oost', 'Schalkwijk', 'Zuidwest', 'Zuid'],
    'Arnhem': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zaanstad': ['Zaandam', 'Koog aan de Zaan', 'Zaandijk', 'Wormerveer', 'Krommenie', 'Assendelft', 'Westzaan'],
    'Amersfoort': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Apeldoorn': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    '\'s-Hertogenbosch': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Hoofddorp': ['Centrum', 'Floriande', 'Toolenburg', 'Overbos'],
    'Maastricht': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Leiden': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Dordrecht': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zoetermeer': ['Centrum', 'Driemanspolder', 'Buytenwegh', 'Seghwaert', 'Rokkeveen', 'Palenstein', 'Stadshart'],
    'Zwolle': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Deventer': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Delft': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Heerlen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Alkmaar': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Venlo': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Leeuwarden': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Hilversum': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Amstelveen': ['Centrum', 'Bovenkerk', 'Westwijk', 'Nesserbos'],
    'Roosendaal': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Purmerend': ['Centrum', 'Overwhere', 'Wheermolen', 'Weidevenne'],
    'Schiedam': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Vlaardingen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Alphen aan den Rijn': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Spijkenisse': ['Centrum', 'Bernisse', 'Heenvliet', 'Zuidland'],
    'Helmond': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Veenendaal': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Gouda': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zaandam': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Hengelo': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Katwijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Barneveld': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'De Bilt': ['Bilthoven', 'De Bilt', 'Groenekan', 'Maartensdijk'],
    'Capelle aan den IJssel': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Den Helder': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Venray': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Velsen': ['IJmuiden', 'Driehuis', 'Santpoort-Noord', 'Santpoort-Zuid', 'Velsen-Noord', 'Velsen-Zuid'],
    'Westland': ['Naaldwijk', 'Monster', 'De Lier', 'Honselersdijk', 'Maasdijk', '\'s-Gravenzande', 'Wateringen'],
    'Emmen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Diemen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Kerkrade': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Heemskerk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Rijswijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Middelburg': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Ede': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Doetinchem': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Harderwijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zwijndrecht': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Dronten': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Oss': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Roermond': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Sittard-Geleen': ['Sittard', 'Geleen', 'Born', 'Munstergeleen'],
    'Tiel': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Veldhoven': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Weert': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Winterswijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zutphen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Almelo': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Beverwijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Culemborg': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Delfzijl': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Goes': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Gorinchem': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Heerhugowaard': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Hoogeveen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Kampen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Lelystad': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Meppel': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Nieuwegein': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Papendrecht': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Ridderkerk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Sneek': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Steenbergen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Terneuzen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Vlissingen': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Waalwijk': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Woerden': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zaltbommel': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zeist': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zevenaar': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West'],
    'Zierikzee': ['Centrum', 'Noord', 'Oost', 'Zuid', 'West']
  };

  // Normalize the region name for lookup (trim and case-insensitive)
  if (!regionName || typeof regionName !== 'string') {
    console.error(`[getFallbackCities] Invalid regionName:`, regionName);
    return [];
  }
  
  const normalizedRegionName = regionName.trim();
  console.log(`[getFallbackCities] Looking up region: "${regionName}" (normalized: "${normalizedRegionName}")`);
  
  // Try exact match first
  let cities = commonCities[normalizedRegionName] || [];
  console.log(`[getFallbackCities] Exact match result: ${cities.length} cities`);
  
  // If no exact match, try case-insensitive lookup
  if (cities.length === 0) {
    const regionKey = Object.keys(commonCities).find(
      key => key.toLowerCase() === normalizedRegionName.toLowerCase()
    );
    if (regionKey) {
      console.log(`[getFallbackCities] Found case-insensitive match: "${regionKey}" (was looking for "${normalizedRegionName}")`);
      cities = commonCities[regionKey];
    } else {
      console.warn(`[getFallbackCities] ❌ No match found for "${normalizedRegionName}"`);
      // Log some similar keys for debugging
      const similarKeys = Object.keys(commonCities).filter(key => 
        key.toLowerCase().includes(normalizedRegionName.toLowerCase().substring(0, 3)) ||
        normalizedRegionName.toLowerCase().includes(key.toLowerCase().substring(0, 3))
      ).slice(0, 5);
      if (similarKeys.length > 0) {
        console.log(`[getFallbackCities] Similar keys found:`, similarKeys);
      }
    }
  }
  
  console.log(`[getFallbackCities] Final result: ${cities.length} local areas for "${normalizedRegionName}"`);
  
  return cities.map(name => ({ name }));
}


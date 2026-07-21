export interface ParsedGPSData {
  imei: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude: number;
  battery?: number;
  ignitionStatus: boolean;
  timestamp: Date;
}

/**
 * A generic GPS packet parser.
 * Since no specific protocol was requested, this parses a simple comma-separated string format:
 * IMEI,LATITUDE,LONGITUDE,SPEED,HEADING,ALTITUDE,BATTERY,IGNITION_STATUS,TIMESTAMP
 * 
 * Example:
 * 123456789012345,19.0760,72.8777,45.5,180,10,85,1,1689312000000
 */
export const parseRawData = (data: Buffer): ParsedGPSData | null => {
  try {
    const rawString = data.toString('utf-8').trim();
    
    // Ignore empty keep-alives
    if (!rawString) return null;

    // Try JSON parsing first
    try {
      // Remove any weird trailing characters just in case
      const jsonStr = rawString.substring(rawString.indexOf('{'), rawString.lastIndexOf('}') + 1);
      if (jsonStr) {
        const json = JSON.parse(jsonStr);
        return {
          imei: String(json.imei),
          latitude: parseFloat(json.latitude),
          longitude: parseFloat(json.longitude),
          speed: parseFloat(json.speed) || 0,
          heading: parseFloat(json.heading) || 0,
          altitude: parseFloat(json.altitude) || 0,
          battery: json.battery ? parseFloat(json.battery) : undefined,
          ignitionStatus: Boolean(json.ignitionStatus),
          timestamp: json.timestamp ? new Date(json.timestamp) : new Date(),
        };
      }
    } catch (e) {
      // Not JSON, continue to fallback
    }

    // Fallback to comma-separated format
    const parts = rawString.split(',');
    if (parts.length >= 3) {
      return {
        imei: parts[0],
        latitude: parseFloat(parts[1]),
        longitude: parseFloat(parts[2]),
        speed: parts[3] ? parseFloat(parts[3]) : 0,
        heading: parts[4] ? parseFloat(parts[4]) : 0,
        altitude: parts[5] ? parseFloat(parts[5]) : 0,
        battery: parts[6] ? parseFloat(parts[6]) : undefined,
        ignitionStatus: parts[7] === '1' || parts[7].toLowerCase() === 'true',
        timestamp: parts[8] ? new Date(parseInt(parts[8])) : new Date(),
      };
    }

    console.warn('[Parser] Unknown format:', rawString);
    return null;
  } catch (error) {
    console.error('[Parser] Failed to parse GPS data:', error);
    return null;
  }
};

const BLOOR_YONGE = ["Bloor-Yonge", "Bloor", "Yonge"];
// West to East, North to South except for Line 1 which is a special snowflake
// Fuck toronto's wayfinding so hard
const STATIONS = {
  1: [
    [
      "VMC",
      "Vaughan Metropolitan Centre",
      "Vaughan Metropolitan Center",
      "Vaughan",
    ],
    ["Hwy 407", "Highway 407"],
    "Pioneer Village",
    "York University",
    "Finch West",
    "Downsview Park",
    "Sheppard West",
    "Wilson",
    "Yorkdale",
    "Lawrence West",
    "Glencarin",
    ["Cedarvale", "Eglinton West"],
    "St. Clair West",
    "Dupont",
    "Spadina",
    "St. George",
    "Museum",
    "Queen's Park",
    "St. Patrick",
    "Osgoode",
    "St. Andrew",
    "Union",
    "King",
    "Queen",
    ["TMU", "Dundas"],
    "College",
    "Wellesley",
    BLOOR_YONGE,
    "Rosedale",
    "Summerhill",
    "St. Clair",
    "Davisville",
    "Eglinton",
    "Lawrence",
    "York Mills",
    "Sheppard-Yonge",
    ["North York Centre", "North York Center"],
    "Finch",
  ],
  2: [
    "Kipling",
    "Islington",
    "Royal York",
    "Old Mill",
    "Jane",
    "Runnymede",
    "High Park",
    "Keele",
    "Dundas West",
    "Lanswdowne",
    "Dufferin",
    "Ossington",
    "Christie",
    "Bathurst",
    "Spadina",
    "St. George",
    "Bay",
    BLOOR_YONGE,
    "Sherbourne",
    "Castle Frank",
    "Broadview",
    "Chester",
    "Pape",
    "Donlands",
    "Greenwood",
    "Coxwell",
    "Woodbine",
    ["Main Street", "Main St."],
    "Victoria Park",
    "Warden",
    "Kennedy",
  ],
  // Line 4 isn't real what do you mean/??
  4: [
    "Sheppard-Yonge",
    "Bayview",
    "Bessarion",
    "Leslie", // Permission to make this @leslie in the discord?
    "Don Mills",
  ],
};

function normalizeStationName(string) {
  return string.toLowerCase().replace(/[-. ']/g, "");
}

// Cache for normalized station names
function createStationCacheMap2(station, index) {
  if (station) {
    if (typeof station == "string") {
      return [[normalizeStationName(station), { prettyName: station, index }]];
    } else if (typeof station == "object") {
      return station.map((alternate) => {
        return [
          normalizeStationName(alternate),
          { prettyName: station[0], index },
        ];
      });
    }
  }
}

// returns Map(potentialMatch: string, {prettyName: string, index: number})
function createStationCacheMap(stations) {
  return new Map(stations.map(createStationCacheMap2).flat());
}

let stationsCache = {
  1: createStationCacheMap(STATIONS[1]),
  2: createStationCacheMap(STATIONS[2]),
  4: createStationCacheMap(STATIONS[4]),
};

// Sort stations
// 0 = West to East, Start to End
// 1 = East to West, End to Start
function sort(direction, stn1, stn2) {
  if (direction == 0) {
    if (stn1.index < stn2.index) {
      return [stn1, stn2];
    } else {
      return [stn2, stn1];
    }
  } else {
    if (stn1.index < stn2.index) {
      return [stn2, stn1];
    } else {
      return [stn1, stn2];
    }
  }
}

// Make sure to handle nulls
// returns [Index, Station1 Display Name, Station2 Display Name, Direction]
function orderDirection(line, directionTerminus, stn1Name, stn2Name) {
  let terminusDetails = matchStationName(line, directionTerminus);

  let stn1 = matchStationName(line, stn1Name);
  let stn2 = matchStationName(line, stn2Name);

  let direction = terminusDetails.prettyName;
  let stationsOrder = [stn1, stn2];
  if (line == 1) {
    let northSouthSwitch = stationsCache[1].get("union").index;
    if (terminusDetails.index != 0) {
      stationsOrder = sort(0, stn1, stn2);
    } else {
      stationsOrder = sort(1, stn1, stn2);
    }

    if (stationsOrder[1].index > northSouthSwitch) {
      if (stationsOrder[0].index < stationsOrder[1].index) direction = "North";
      else direction = "South";
    } else {
      if (stationsOrder[0].index < stationsOrder[1].index) direction = "South";
      else direction = "North";
    }
  } else {
    if (terminusDetails.index != 0) {
      direction = "East";
      stationsOrder = sort(0, stn1, stn2);
    } else {
      direction = "West";
      stationsOrder = sort(1, stn1, stn2);
    }
  }
  return {
    index: stationsOrder[0].index,
    stationsOrder: stationsOrder.map((a) => a.prettyName),
    direction,
    terminus: terminusDetails.prettyName,
  };
}

function getStationName(line, index) {
  if (STATIONS[line]) {
    const station = STATIONS[line].at(index);
    if (station) {
      if (typeof station == "string") {
        return station;
      } else if (typeof station == "object") {
        return station[0];
      }
    }
  }
  return null;
}

function matchStationName(line, name) {
  const normName = normalizeStationName(name);
  return stationsCache[line].get(normName);
}

function int(str) {
  return parseInt(str.replace(/[ ,]/g, ""));
}

export default class TableEntry {
  // fromStation: string;
  // toStation: string;
  // directionTerminus: string;
  // direction: string;
  // line: "1" | "2" | "4";
  // order: number;
  // affectedLengthMeters?: number;
  // percentUnderReduceSpeed?: number;
  // reducedSpeedKmph?: number;
  // normalSpeedKmph?: number;
  // distanceBetweenStnsMeters?: number;
  // reason?: string;
  // targetRemoval?: string;

  constructor(row, header, title) {
    // Fucking awful, and typescript won't let me break this out elsewhere
    if (title.startsWith("Line 1")) {
      this.line = "1";
    } else if (title.startsWith("Line 2")) {
      this.line = "2";
    } else if (title.startsWith("Line 4")) {
      this.line = "4";
    } else {
      throw new Error("What line is this?: " + title);
    }

    if (title.includes("Sheppard")) {
      this.directionTerminus = "sheppardyonge";
    } else if (title.includes("Don Mills")) {
      this.directionTerminus = "donmills";
    } else if (title.includes("Kipling")) {
      this.directionTerminus = "kipling";
    } else if (title.includes("Kennedy")) {
      this.directionTerminus = "kennedy";
    } else if (title.includes("Vaughan")) {
      this.directionTerminus = "vmc";
    } else if (title.includes("Finch")) {
      this.directionTerminus = "finch";
    } else {
      throw new Error("Cant find direction terminus for title: " + title);
    }

    // replace with pretty station name
    this.directionTerminus = matchStationName(
      this.line,
      this.directionTerminus,
    ).prettyName;

    let rowAsObject = {};
    for (let i in row) {
      rowAsObject[header[i]] = row[i];
    }

    if (rowAsObject["Location"]) {
      // We'll determine direction ourselves later
      let directionRow = rowAsObject["Location"]
        .replace("Southbound ", "")
        .replace("Northbound ", "")
        .replace("Westbound ", "")
        .replace("Eastbound ", "")
        .split(" to ");

      let { index, stationsOrder, direction } = orderDirection(
        this.line,
        this.directionTerminus,
        directionRow[0],
        directionRow[1],
      );
      ((this.order = index), (this.fromStation = stationsOrder[0]));
      this.toStation = stationsOrder[1];
      this.direction = direction;
    } else throw new Error("No direction?");

    // Make these but empty so that the object contains all fields as expected
    this.affectedLengthMeters =
      this.distanceBetweenStnsMeters =
      this.percentUnderReduceSpeed =
      this.reducedSpeedKmph =
      this.normalSpeedKmph =
      this.reason =
      this.targetRemoval =
        "";

    if (rowAsObject["Length of defect (metres)"])
      this.affectedLengthMeters = int(rowAsObject["Length of defect (metres)"]);
    if (rowAsObject["Distance between stations (metres)"])
      this.distanceBetweenStnsMeters = int(
        rowAsObject["Distance between stations (metres)"],
      );
    if (rowAsObject["Track under reduced speed (%)"])
      this.percentUnderReduceSpeed = int(
        rowAsObject["Track under reduced speed (%)"],
      );
    if (rowAsObject["Reduced speed (km/h)"])
      this.reducedSpeedKmph = int(rowAsObject["Reduced speed (km/h)"]);
    if (rowAsObject["Normal speed (km/h)"])
      this.normalSpeedKmph = int(rowAsObject["Normal speed (km/h)"]);
    if (rowAsObject["Reason"]) this.reason = rowAsObject["Reason"];
    if (rowAsObject["Target removal"])
      this.targetRemoval = rowAsObject["Target removal"];
  }

  toJSON() {
    return {
      fromStation: this.fromStation,
      toStation: this.toStation,
      directionTerminus: this.directionTerminus,
      direction: this.direction,
      line: this.line,
      order: this.order,
      affectedLengthMeters: this.affectedLengthMeters,
      percentUnderReduceSpeed: this.percentUnderReduceSpeed,
      reducedSpeedKmph: this.reducedSpeedKmph,
      normalSpeedKmph: this.normalSpeedKmph,
      distanceBetweenStnsMeters: this.distanceBetweenStnsMeters,
      reason: this.reason,
      targetRemoval: this.targetRemoval,
    };
  }
}

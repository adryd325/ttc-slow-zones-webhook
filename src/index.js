import { markdownTable } from "markdown-table";
import { Resvg } from "@resvg/resvg-js";
import FormData from "form-data";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import child_process from "child_process";

import { stringify as toCsv } from "csv-stringify/sync";
import { parse as fromCsv } from "csv-parse/sync";
import { diffLines } from "diff";
const slowZonesPage =
  "https://www.ttc.ca/riding-the-ttc/Updates/Reduced-Speed-Zones";

const webhooks = [];
const errorWebhooks = [];

import { parse as parseHtml } from "node-html-parser";
import TableEntry from "./TableEntry.js";

// Load webhooks list
const webhooksTxt = fs
  .readFileSync("webhooks.txt", "utf-8")
  .split("\n")
  .filter((a) => !a.startsWith("#"))
  .map((a) =>
    a.trim().replace(/^(https:\/\/)?(ptb\.|canary\.)?discord(app)?\.com/, ""),
  );
webhooks.push(...webhooksTxt);
if (webhooks[0]) {
  errorWebhooks.push(webhooks[0]);
}

const urlRegexp = /"(https:(.+?)\/TTC_Reduced-Speed-Zones_MAIN\.svg\?(.+?))"/;

async function sendError(error) {
  console.log(error);
  for (let i of errorWebhooks) {
    await fetch("https://discord.com" + i, {
      method: "POST",
      body: JSON.stringify({ content: "```Error: " + error.stack + "```" }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function sendErrorTxt(error) {
  for (let i of errorWebhooks) {
    await fetch("https://discord.com" + i, {
      method: "POST",
      body: JSON.stringify({ content: "```Error: \n" + error + "```" }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function sendWebhook(image, updatedDate, tableStr) {
  let text = "The TTC slow zones page was updated!\n";
  text += "**Updated date on page**: <t:" + Math.floor(updatedDate.getTime() / 1000) + ">\n";
  text += "-# This table is probably not reflective of actual slow zones."
  text += "The actual list updates multiple times a day and the published one lags behind\n";

  for (let i in webhooks) {
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: text,
      }),
    );
    form.append("file[0]", Buffer.from(image), "rendered.png");

    form.submit(
      {
        host: "discord.com",
        path: webhooks[i],
        protocol: "https:",
      },
      async function (err, res) {
        if (err) {
          sendError(err);
        }
        // After the main message with the image is sent, send the table contents
        await fetch("https://discord.com" + webhooks[i], {
          method: "POST",
          body: JSON.stringify({ content: tableStr }),
          headers: { "Content-Type": "application/json" },
        });
      },
    );
  }
}

function getUpdatedDate(html) {
  const updatedDateString = html
    .querySelector(".updated-date")
    .text.replace("Last Updated: ", "");

  const currentYear = new Date().getFullYear();
  let splitDate = updatedDateString.split(", ");
  splitDate[0] += " " + currentYear;

  let date = new Date(splitDate.join(","));

  if (date.getTime() > Date.now()) {
    date.setFullYear(currentYear - 1);
  }
  return date;
}

function getTables(html) {
  const htmlContainers = html.querySelectorAll(".reduced-speed-zone-table");
  let tables = [];

  for (let containerEl of htmlContainers) {
    let title = containerEl.querySelector(".line-header h2").text;
    let tableEl = containerEl.querySelector("table");

    let headings = tableEl.querySelectorAll("thead tr th").map((a) => {
      let text = a.text;
      return text;
    });

    let content = tableEl.querySelectorAll("tbody tr").map((a) => {
      let row = a.querySelectorAll("td").map((a) => a.text.trim());
      return row;
    });

    tables.push({ table: [...content], headings, title });
  }
  return tables;
}

function processTables(tables) {
  const newRows = [];
  for (let table of tables) {
    for (let row of table.table) {
      newRows.push(new TableEntry(row, table.headings, table.title));
    }
  }

  newRows.sort(function compareFn(wa, wb) {
    let a = (parseInt(wa.line) << 10) | wa.order;
    let b = (parseInt(wb.line) << 10) | wb.order;
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    }
    return 0;
  });

  return newRows;
}

/* Gross hack to get a diff that looks like a markdown table
 * Takes a diff of the two CSV and makes a new CSV with the first column being
 * the state of the diff. Then turn that into a markdown table, and replace 
 * the `| ` at the start of each line with nothing so that it renders like so:
```diff
  | Ln | From           | To            | Direction            |
  | -- | -------------- | ------------- | -------------------- |
  | 1  | Spadina        | Dupont        | North towards VMC    |
+ | 1  | Museum         | St. George    | North towards VMC    |
  | 1  | Union          | King          | North towards Finch  |
- | 1  | Queen          | TMU           | North towards Finch  |
  | 1  | TMU            | College       | North towards Finch  |
```
*/
function diffAndPrintTables(oldTable, newTable) {
  let oldTableStr = toCsv(oldTable);
  let newTableStr = toCsv(newTable);

  let diff = diffLines(oldTableStr, newTableStr);

  let diffCsv = diff
    .map((part) => {
      let symbol = "=,";
      if (part.added) {
        symbol = "+,";
      }
      if (part.removed) {
        symbol = "-,";
      }
      return part.value
        .split("\n")
        .filter((a) => a != "")
        .map((a) => symbol + a);
    })
    .flat()
    .join("\n");

  let diffTable = markdownTable(fromCsv(diffCsv))
    .split("\n")
    .map((a, i) => {
      if (i == 1) {
        return a.replace("| - ", "  ");
      } else {
        return a
          .replace("| - ", "- ")
          .replace("| + ", "+ ")
          .replace("| = ", "  ");
      }
    })
    .join("\n");

  let text = "";
  text += "\n```diff\n";
  text += diffTable;
  text += "\n```\n";

  return text;
}

// Lazy
function makeIntoArray(jsonTable) {
  let table = [["Ln", "From", "To", "Direction"]];
  for (let row of jsonTable) {
    table.push([
      row.line,
      row.fromStation,
      row.toStation,
      `${row.direction} towards ${row.directionTerminus}`,
    ]);
  }
  return table;
}

// Also lazy
function makeIntoArrayAllKeys(jsonTable) {
  let header = [
    "line",
    "fromStation",
    "toStation",
    "directionTerminus",
    "direction",
    "order",
    "affectedLengthMeters",
    "percentUnderReduceSpeed",
    "reducedSpeedKmph",
    "normalSpeedKmph",
    "distanceBetweenStnsMeters",
    "reason",
    "targetRemoval",
  ];
  let table = [header];
  for (let i of jsonTable) {
    table.push(header.map((a) => i[a]));
  }
  return table;
}

const GIT_DIR = "state";
const STATE_TABLES_FILE = path.join(GIT_DIR, "raw-tables-current.json");
const STATE_SVG_FILE = path.join(GIT_DIR, "map-current.svg");
const readmeTemplate = fs.readFileSync("./REPO_README_TEMPLATE.md", "utf-8");

// Load state on program start
let lastImageHash = "";
let lastTable = "";
try {
  let lastImage = fs.readFileSync(STATE_SVG_FILE, "utf-8");
  lastImageHash = createHash("sha256").update(lastImage).digest("hex");
  lastTable = JSON.parse(fs.readFileSync(STATE_TABLES_FILE, "utf-8"));
} catch (e) {
  console.error("Failed to load lastTable or lastImage");
}

async function updateState(
  rawTables,
  updatedDate,
  imageData,
  imageRendered,
  diffedTables,
  csv,
) {
  let year = updatedDate.getFullYear().toString();
  let month = (updatedDate.getMonth() + 1).toString().padStart(2, "0");
  let day = updatedDate.getDate().toString().padStart(2, "0");
  let dateDir = path.join(GIT_DIR, year, month, day);

  let niceDate = `${year}-${month}-${day} ${updatedDate.getHours()}:${updatedDate.getMinutes()}`

  // We can skip creating outDir cause it'll be created here
  await fs.promises.mkdir(dateDir, { recursive: true });

  // Writing these two are actually important to the functionality of this program
  await fs.promises.writeFile(STATE_TABLES_FILE, JSON.stringify(rawTables));
  await fs.promises.writeFile(STATE_SVG_FILE, imageData);

  // And these are for the repo
  await fs.promises.writeFile(
    path.join(GIT_DIR, "map-current.png"),
    imageRendered,
  );
  await fs.promises.writeFile(
    path.join(GIT_DIR, "slow-zones-current.csv"),
    JSON.stringify(csv),
  );

  // Day folders
  await fs.promises.copyFile(
    STATE_TABLES_FILE,
    path.join(dateDir, "tables-raw.json"),
  );
  await fs.promises.copyFile(STATE_SVG_FILE, path.join(dateDir, "map.svg"));
  await fs.promises.copyFile(
    path.join(GIT_DIR, "slow-zones-current.csv"),
    path.join(dateDir, "slow-zones.csv"),
  );

  // Update readme
  await fs.promises.writeFile(
    path.join(GIT_DIR, "README.md"),
    readmeTemplate
      .replace("--- table goes here ---", diffedTables)
      .replace("--- updated date goes here---", niceDate),
  );

  // This is goofy, I doubt most people would want to have this running
  if (process.env.UPDATE_GIT_REPO != "true") return;

  // One should probably do this with git bindings, however I don't care
  child_process.exec(
    `bash ./repo_commit.sh '${updatedDate}' '${niceDate}'`,
    (error, stdout, stderr) => {
      if (error) {
        sendErrorTxt(`git \n${stdout}\n\n${stderr}`);
      }
      // Debugging:
      console.log(stdout);
      console.log(stderr);
    },
  );
}

async function checkUpdate() {
  try {
    // Fetch page contents
    let pageContent;
    try {
      const pageResponse = await fetch(slowZonesPage);
      pageContent = await pageResponse.text();
    } catch (e) {
      sendError(e);
      return;
    }

    // Parse
    const html = parseHtml(pageContent);
    let updatedDate = getUpdatedDate(html);
    let rawTables = getTables(html);
    let imageUrl = pageContent.match(urlRegexp)[1].replaceAll("&amp;", "&");

    // Fetch slow zones image
    let imageData;
    try {
      const imageResponse = await fetch(imageUrl);
      imageData = await imageResponse.text();
    } catch (e) {
      sendError(e);
      return;
    }

    // Exit if nothing has changed
    let imageHash = createHash("sha256").update(imageData).digest("hex");
    let textHash = createHash("sha256").update(JSON.stringify(rawTables)).digest("hex");
    let lastTextHash = createHash("sha256").update(JSON.stringify(lastTable)).digest("hex");
    console.log("Fetched page at", new Date())
    console.log("      | old   ?=?   new |")
    console.log("text  : " + lastImageHash.slice(0,6) + " = " + imageHash.slice(0,6) + " ?")
    console.log("image : " + lastTextHash.slice(0,6) + " = " + textHash.slice(0,6) + " ?")
    if (
      lastImageHash == imageHash &&
      lastTextHash == textHash
    ) {
      return;
    }

    let imageRendered;
    try {
      imageRendered = new Resvg(imageData, {
        fitTo: {
          mode: "width",
          value: 2000,
        },
      })
        .render()
        .asPng();
    } catch (e) {
      sendError(e);
      return;
    }

    let processedTable = processTables(rawTables);
    let processedOldTable = processTables(lastTable);

    let diffedTables = diffAndPrintTables(
      makeIntoArray(processedOldTable),
      makeIntoArray(processedTable),
    );


    console.log("Slow zone page updated at", updatedDate)
    console.log(diffedTables)
    console.log("")
    await sendWebhook(imageRendered, updatedDate, diffedTables);
    updateState(
      rawTables,
      updatedDate,
      imageData,
      imageRendered,
      diffedTables,
      toCsv(makeIntoArrayAllKeys(processedTable)),
    );

    lastImageHash = createHash("sha256").update(imageData).digest("hex");
    lastTable = rawTables;
  } catch (e) {
    sendError(e);
  }
}

// Every 30 Minutes
setTimeout(checkUpdate, 2000);
setInterval(checkUpdate, 30 * 60 * 1000);

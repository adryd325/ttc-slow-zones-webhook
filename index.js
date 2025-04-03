import { markdownTable } from "markdown-table";
import { Resvg } from "@resvg/resvg-js";
import FormData from "form-data";
import { createHash, hash } from "crypto";
import fs from "fs";

const slowZonesPage =
  "https://www.ttc.ca/riding-the-ttc/Updates/Reduced-Speed-Zones";

const webhooks = [];
const errorWebhooks = [];

// Load webhooks list
const webhooksTxt = fs
  .readFileSync("webhooks.txt", "utf-8")
  .split("\n")
  .filter((a) => a.startsWith("#"))
  .map((a) =>
    a.trim().replace(/^(https:\/\/)?(ptb\.|canary\.)?discord(app)?\.com/, "")
  );
webhooks.push(...webhooksTxt);
if (webhooks[0]) {
  errorWebhooks.push(webhooks[0]);
}

const urlRegexp = /"(https:(.+?)\/TTC_Reduced-Speed-Zones_MAIN\.svg\?(.+?))"/;
const table1Regexp =
  /<table>\s+(<tbody>|<thead>)\s+<tr>\s+<td><strong>Line 1 between.+?<\/table>/s;
const table2Regexp =
  /<table>\s+(<tbody>|<thead>)\s+<tr>\s+<td><strong>Line 2 between.+?<\/table>/s;
const table4Regexp =
  /<table>\s+(<tbody>|<thead>)\s+<tr>\s+<td><strong>Line 4 between.+?<\/table>/s;

let lastTextHash = "";
let lastImageHash = "";

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

function sendWebhook(image, textBlocks) {
  let text = "# The TTC slow zones page was updated:\n";
  text += textBlocks
    .filter((a) => a.length != 0)
    .map((a) => `\`\`\`md\n${a}\n\`\`\``)
    .join("\n");
  text += "\u200b";

  for (let i in webhooks) {
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: text,
      })
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
      }
    );
  }
}

// The worst html parsing code you've ever seen
// Could I even call this a parser?
function parseTable(tableStr) {
  if (typeof tableStr != "string") {
    return "";
  }

  // tidy
  tableStr = tableStr.replaceAll("&nbsp;", " ");
  tableStr = tableStr.replaceAll("<span> </span>", "");
  tableStr = tableStr.replaceAll("<br />", "");
  tableStr = tableStr.replaceAll("\n", "");
  tableStr = tableStr.replaceAll("\n", "");
  tableStr = tableStr.replaceAll("<strong>", "**");
  tableStr = tableStr.replaceAll("</strong>", "**");
  tableStr = tableStr.replaceAll("<table>", "");
  tableStr = tableStr.replaceAll("<tbody>", "");
  tableStr = tableStr.replaceAll("</tr>", "");
  tableStr = tableStr.replaceAll("</td>", "");
  tableStr = tableStr.replaceAll("</table>", "");
  tableStr = tableStr.replaceAll("</tbody>", "");

  const table = tableStr
    .split("<tr>")
    // For each split at tr, remove all whitespace only lines, then trim whitespace
    .map((a) =>
      a
        .split("<td>")
        .filter((a) => !a.match(/^\s+$/))
        .map((a) => a.trim())
    )
    .filter((a) => a.length != 0);

  return markdownTable(table);
}

async function checkUpdate() {
  // Fetch page contents
  let pageContent;
  try {
    const pageResponse = await fetch(slowZonesPage);
    pageContent = await pageResponse.text();
  } catch (e) {
    sendError(e);
    return;
  }
  // Extract information
  let table1Contents = parseTable(pageContent.match(table1Regexp)?.[0]);
  let table2Contents = parseTable(pageContent.match(table2Regexp)?.[0]);
  let table4Contents = parseTable(pageContent.match(table4Regexp)?.[0]);

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

  let imageHash = createHash("sha256").update(imageData).digest("hex");
  let textHash = createHash("sha256")
    .update(table1Contents + table2Contents + table4Contents)
    .digest("hex");

  if (
    (lastImageHash == "" && lastTextHash == "") ||
    (lastImageHash == imageHash && lastTextHash == textHash)
  ) {
    lastImageHash = imageHash;
    lastTextHash = textHash;
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

  sendWebhook(imageRendered, [table1Contents, table2Contents, table4Contents]);

  await fs.promises.writeFile("latest.svg", imageData);
  fs.promises.copyFile("latest.svg", Date.now() + ".svg");
}

// Every 30 Minutes
checkUpdate();
setInterval(checkUpdate, 30 * 60 * 1000);

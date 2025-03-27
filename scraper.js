
const puppeteer = require("puppeteer");
const fs = require("fs");
const { Parser } = require("json2csv");

(async () => {
    const browser = await puppeteer.launch({ headless: "new", protocolTimeout: 120000 });
    const page = await browser.newPage();

    const baseUrl = "https://www.sharktankindiaclub.com";
    const seasons = [
        "/season-1/",
        "/sample-page/",  // Season 2
        "/shark-tank-india-unseen-pitches/", // Season 3
        "/season-4/"
    ];

    let scrapedData = [];

    for (let season of seasons) {
        const url = `${baseUrl}${season}`;
        console.log(`🔄 Navigating to ${url}...`);

        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
            const seasonTitle = await page.$eval("h1.entry-title", el => el.textContent.trim());
            console.log(`✅ Found season: ${seasonTitle}`);

            // Extract company details (Name + Link)
            const companies = await page.$$eval(".ub-button-container", buttons => {
                return buttons.map(button => ({
                    name: button.querySelector(".ub-button-block-btn")?.textContent.trim(),
                    link: button.querySelector("a")?.href
                })).filter(company => company.link); // Remove entries with no links
            });

            console.log(`📌 Found ${companies.length} companies in ${seasonTitle}`);

            for (let company of companies) {
                console.log(`🔍 Scraping details for ${company.name}...`);
                
                try {
                    await page.goto(company.link, { waitUntil: "domcontentloaded", timeout: 120000 });

                    // Extracting details from <div class="entry-content">
                    const details = await page.$$eval(".entry-content li", items => {
                        let obj = {};
                        items.forEach(item => {
                            const strongTag = item.querySelector("strong");
                            if (strongTag) {
                                const key = strongTag.textContent.replace(":", "").trim();
                                const value = strongTag.nextSibling?.textContent.trim() || item.innerText.replace(strongTag.textContent, "").trim();
                                obj[key] = value;
                            }
                        });
                        return obj;
                    });

                    if (Object.keys(details).length === 0) {
                        console.log(`⚠️ No details found for ${company.name}, skipping.`);
                        continue;
                    }

                    scrapedData.push({
                        Season: seasonTitle,
                        Company: company.name,
                        Link: company.link,
                        ...details
                    });

                    console.log(`✅ Data saved for ${company.name}`);
                } catch (error) {
                    console.error(`❌ Error scraping ${company.name}: ${error.message}`);
                    continue;
                }
            }
        } catch (error) {
            console.error(`❌ Error loading season page ${season}: ${error.message}`);
            continue;
        }
    }

    if (scrapedData.length === 0) {
        console.log("❌ No data scraped. Check selectors and website structure.");
    } else {
        // Save JSON
        fs.writeFileSync("shark_tank_data.json", JSON.stringify(scrapedData, null, 2));
        console.log("✅ JSON file saved: shark_tank_data.json");

        // Convert to CSV and Save
        const parser = new Parser();
        const csv = parser.parse(scrapedData);
        fs.writeFileSync("shark_tank_data.csv", csv);
        console.log("✅ CSV file saved: shark_tank_data.csv");
    }

    await browser.close();
})();

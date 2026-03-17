let scrapedData = [];

document.getElementById("extractBtn").addEventListener("click", async () => {

    const status = document.getElementById("status");
    status.innerText = "Extracting data...";

    let [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: scrapeMaps
    }, (results) => {

        let data = results[0].result || [];

        // Deduplicate by URL
        scrapedData = [...new Map(data.map(item => [item.url, item])).values()];

        renderTable(scrapedData);

        status.innerText = `Extracted ${scrapedData.length} places`;

    });

});

function scrapeMaps() {
    const cards = document.querySelectorAll('[role="article"]');
    const places = [];

    cards.forEach(card => {
        // 1. Name
        let name = card.querySelector(".qBF1Pd")?.innerText || "";
        if (!name) {
            const altName = card.querySelector("a.hfpxzc")?.getAttribute("aria-label");
            if (altName) name = altName.split("·")[0].trim();
        }

        // 2. URL
        const linkEl = card.querySelector("a.hfpxzc");
        const url = linkEl ? linkEl.href : "";

        // 3. Rating
        const rating = card.querySelector(".MW4etd")?.innerText || "";

        // 4. Review count
        const reviews = card.querySelector(".UY7F9")?.innerText || "";

        // 5. Price
        let price = "";
        const priceMatch = card.innerText.match(/[$&](\d+(?:\s*[^\d\s]\s*\d+)?\+?)/);
        if (priceMatch) price = priceMatch[0];

        // 6. Category, 7. Address, 8. Status
        let category = "";
        let address = "";
        let status = "";

        const infoBlocks = card.querySelectorAll(".W4Efsd");
        if (infoBlocks.length >= 2) {
            // Usually the 2nd block has category + address
            const secondBlock = infoBlocks[1];
            const spans = secondBlock.querySelectorAll("span > span");
            spans.forEach(span => {
                const text = span.innerText.trim();
                if (!category && text.length < 40 && !/\d/.test(text)) {
                    category = text; // e.g., "Italian" or "Restaurant"
                } else if (!address && /\d/.test(text)) {
                    address = text; // street with numbers
                }
            });
        }

        // Status is usually in the last W4Efsd block
        const lastBlock = infoBlocks[infoBlocks.length - 1];
        const statusSpan = lastBlock.querySelector("span");
        if (statusSpan) status = statusSpan.innerText.trim();

        // 9. Image
        const img = card.querySelector("img")?.src || "";

        // 10. Review snippet
        const snippet = card.querySelector(".ah5Ghc span")?.innerText || "";

        places.push({
            name,
            category,
            rating,
            reviews,
            price,
            address,
            status,
            snippet,
            img,
            url
        });
    });

    return places;
}

function renderTable(data){
    const tbody = document.querySelector("#resultsTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    data.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.name}</td>
            <td>${row.category}</td>
            <td>${row.rating}</td>
            <td>${row.reviews}</td>
            <td>${row.price}</td>
            <td>${row.address}</td>
            <td>${row.status}</td>
            <td>${row.img ? `<img src="${row.img}" width="60" height="60" style="object-fit:cover;border-radius:6px;">` : ""}</td>
            <td><a href="${row.url}" target="_blank">Open</a></td>
        `;

        tbody.appendChild(tr);
    });
}


document.getElementById("downloadBtn").addEventListener("click", () => {

    if(scrapedData.length === 0){
        alert("No data extracted yet");
        return;
    }

    const csvRows = [];

    const headers = [
        "name","category","rating","reviews",
        "price","address","status","snippet","img","url"
    ];

    csvRows.push(headers.join(","));

    scrapedData.forEach(row => {

        const values = headers.map(h => {
            const val = row[h] || "";
            return `"${val.replace(/"/g, '""')}"`;
        });

        csvRows.push(values.join(","));

    });

    const csvString = csvRows.join("\n");

    const blob = new Blob([csvString], {type: "text/csv"});
    const url = URL.createObjectURL(blob);

    // Custom file name or fallback
    let fileNameInput = document.getElementById("filenameInput").value.trim();
    if(!fileNameInput) fileNameInput = "google_maps_places";
    if(!fileNameInput.toLowerCase().endsWith(".csv")) fileNameInput += ".csv";

    chrome.downloads.download({
        url: url,
        filename: fileNameInput
    });

});
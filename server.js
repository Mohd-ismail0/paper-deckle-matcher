const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const cors = require("cors");
const path = require("path");

const app = express();

// Enable CORS for all routes
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "client/build")));

// Parse JSON bodies
app.use(express.json());

// Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() });

function organizeOrders(orders, maxDeckle) {
    const batches = [];
    orders.sort((a, b) => b.deckle - a.deckle);

    let currentBatch = [];
    let currentDeckleUsage = 0;
    let currentReels = 0;

    for (let order of orders) {
        const orderDeckle = order.deckle;
        const reelRequirement = Math.max(order.reelQty - order.stockReal, 0);

        if (reelRequirement > 0) {
            if (currentDeckleUsage + orderDeckle <= maxDeckle) {
                currentBatch.push({ ...order, reelsNeeded: reelRequirement });
                currentDeckleUsage += orderDeckle;
                currentReels += reelRequirement;
            } else {
                const waste = maxDeckle - currentDeckleUsage;
                batches.push({
                    orders: currentBatch,
                    waste,
                    totalReels: currentReels,
                });

                currentBatch = [{ ...order, reelsNeeded: reelRequirement }];
                currentDeckleUsage = orderDeckle;
                currentReels = reelRequirement;
            }
        }
    }

    if (currentBatch.length) {
        const waste = maxDeckle - currentDeckleUsage;
        batches.push({ orders: currentBatch, waste, totalReels: currentReels });
    }

    return batches;
}
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});


// Upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
    console.log("Upload request received"); // Debug log
    
    const file = req.file;
    if (!file) {
        console.log("No file in request"); // Debug log
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        console.log("Processing file..."); // Debug log
        const workbook = XLSX.read(file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const orders = XLSX.utils.sheet_to_json(sheet);

        if (!orders || orders.length === 0) {
            console.log("Empty or invalid file"); // Debug log
            return res.status(400).json({ error: "Uploaded file is empty or improperly formatted" });
        }

        const maxDeckle = 3500;
        const groupedOrders = {};

        orders.forEach((order) => {
            const key = `${order.BF}-${order.GSM}`;
            if (!groupedOrders[key]) groupedOrders[key] = [];
            groupedOrders[key].push({
                orderId: order["OrderNo"],
                party: order.party,
                itemName: order.ItemName,
                bf: order.BF,
                gsm: order.GSM,
                deckle: order.size,
                reelQty: order.Reelqty,
                stockReal: order.Stockreal,
                deliveryDate: order.DelDate,
            });
        });

        const batchesByGroup = {};
        for (const [key, orders] of Object.entries(groupedOrders)) {
            batchesByGroup[key] = organizeOrders(orders, maxDeckle);
        }

        console.log("Successfully processed file"); // Debug log
        res.json(batchesByGroup);
    } catch (err) {
        console.error("Error processing file:", err); // Debug log
        res.status(500).json({ error: "Error processing file" });
    }
});

// Catch all routes and serve index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
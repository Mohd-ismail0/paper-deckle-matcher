import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";

function App() {
    const [batches, setBatches] = useState([]);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const organizeOrders = (orders, maxDeckle) => {
        const batches = [];
        orders.sort((a, b) => b.deckle - a.deckle);
        let currentBatch = [];
        let currentDeckleUsage = 0;
        let currentReels = 0;

        for (let order of orders) {
            const orderDeckle = order.deckle;
            const reelRequirement = Math.max(
                order.reelQty - order.stockReal,
                0,
            );
            if (reelRequirement > 0) {
                if (currentDeckleUsage + orderDeckle <= maxDeckle) {
                    currentBatch.push({
                        ...order,
                        reelsNeeded: reelRequirement,
                    });
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
            batches.push({
                orders: currentBatch,
                waste,
                totalReels: currentReels,
            });
        }

        return batches;
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) {
            setError("Please select a file");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const orders = XLSX.utils.sheet_to_json(sheet);

            if (!orders || orders.length === 0) {
                throw new Error(
                    "Uploaded file is empty or improperly formatted",
                );
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

            setBatches(batchesByGroup);
        } catch (err) {
            console.error("Error processing file:", err);
            setError(err.message || "Error processing file");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="App">
            <h1>Order Batching System</h1>
            <div className="upload-container">
                <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".xlsx,.xls"
                />
                {isProcessing && <span className="spinner"></span>}
            </div>
            {error && <p className="error-message">{error}</p>}
            {Object.keys(batches).length > 0 && (
                <div className="batch-container">
                    <h2>Batched Orders</h2>
                    {Object.entries(batches).map(([group, batchData]) => (
                        <div key={group} className="batch-group">
                            <h3>BF-GSM Group: {group}</h3>
                            {batchData.map((batch, index) => (
                                <table key={index} className="batch-table">
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Party</th>
                                            <th>Item Name</th>
                                            <th>BF</th>
                                            <th>GSM</th>
                                            <th>Deckle</th>
                                            <th>Reel Qty</th>
                                            <th>Stock Real</th>
                                            <th>Delivery Date</th>
                                            <th>Reels Needed</th>
                                            <th>Batch Waste</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {batch.orders.map((order, idx) => (
                                            <tr key={idx}>
                                                <td>{order.orderId}</td>
                                                <td>{order.party}</td>
                                                <td>{order.itemName}</td>
                                                <td>{order.bf}</td>
                                                <td>{order.gsm}</td>
                                                <td>{order.deckle}</td>
                                                <td>{order.reelQty}</td>
                                                <td>{order.stockReal}</td>
                                                <td>{order.deliveryDate}</td>
                                                <td>{order.reelsNeeded}</td>
                                                {idx === 0 && (
                                                    <td
                                                        rowSpan={
                                                            batch.orders.length
                                                        }
                                                        className="waste-cell"
                                                    >
                                                        {batch.waste}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default App;

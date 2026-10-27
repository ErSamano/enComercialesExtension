# User manual

## What it is

enComerciales helps you decide whether the price of a bottle is good compared with prices previously collected by the project.

## How to use it

1. Open Chrome or Edge and visit a supported retailer.
2. Open a product page.
3. Click the enComerciales toolbar icon.
4. Review the current price, rating, historical range, best store, and confidence.

Historical Low is the lowest trusted recorded price. Historical Average is the average trusted recorded price. Historical High is the highest trusted recorded price. Best Store is the retailer associated with the lowest observation. Last Updated is the newest history date. Match Confidence describes how sure the system is that this bottle matches the history; `UNKNOWN` means do not rely on the comparison.

`GREAT DEAL` is at the historical low or at least 10% below average. `GOOD DEAL` is 3–10% below average. `NORMAL PRICE` is within the normal range. `EXPENSIVE` is more than 10% above average. `INSUFFICIENT DATA` means there are fewer than three usable observations.

Price observation uploads are disabled in the shipped extension. The API development code retains observation support, with those records stored separately from trusted history.

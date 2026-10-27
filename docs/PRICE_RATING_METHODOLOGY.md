# Price rating methodology

Ratings are deterministic and explainable. A product needs at least three historical observations and a current numeric price; otherwise the result is `INSUFFICIENT DATA`.

* `GREAT DEAL`: current price is at or below 102% of the historical low, or at least 10% below the historical average.
* `GOOD DEAL`: current price is 3–10% below the historical average.
* `NORMAL PRICE`: current price is from 3% below through 10% above the historical average.
* `EXPENSIVE`: current price is more than 10% above the historical average.

The popup displays the category and the calculation reason. The minimum, maximum, and average are calculated from available trusted history; no missing values are fabricated. The current implementation does not include browser observations in these statistics.

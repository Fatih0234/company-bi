SELECT 42 AS answer;

SELECT region, SUM(revenue) AS revenue
FROM read_csv_auto('.pi/extensions/duckdb-bi/tests/fixtures/sales.csv')
GROUP BY region
ORDER BY revenue DESC;

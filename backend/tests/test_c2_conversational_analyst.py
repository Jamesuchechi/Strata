"""Acceptance tests for Phase C2: Conversational AI Analyst and Self-Correction Loop."""

import duckdb
import pytest
from strata_api.ai.analyst import ConversationalAnalyst
from strata_api.ai.executor import QueryExecutor
from strata_api.ai.providers import LLMProvider
from strata_api.core.duckdb_engine import DuckDBEngine


class MockLLMProvider:
    """Mock provider allowing custom scripted responses for testing analyst workflows."""

    provider_name = "mock"

    def __init__(self, responses: list[str]):
        self.responses = list(responses)
        self.call_count = 0
        self.received_prompts = []

    async def complete(self, system: str, user: str, *, json_mode: bool = False, model: str = None) -> str:
        self.received_prompts.append({"system": system, "user": user})
        if self.call_count < len(self.responses):
            resp = self.responses[self.call_count]
            self.call_count += 1
            return resp
        return '{"sql": null, "explanation": "No more mock responses"}'


@pytest.fixture
def sales_engine():
    """Setup an in-memory DuckDB engine with a realistic e-commerce sales dataset."""
    engine = DuckDBEngine(":memory:")
    # Create test table
    engine.conn.execute("""
        CREATE TABLE ecom_orders (
            order_id INTEGER,
            customer_id INTEGER,
            category VARCHAR,
            amount DOUBLE,
            status VARCHAR,
            region VARCHAR
        );
        INSERT INTO ecom_orders VALUES
            (1, 101, 'Electronics', 500.0, 'completed', 'North America'),
            (2, 102, 'Clothing', 50.0, 'completed', 'Europe'),
            (3, 103, 'Electronics', 1200.0, 'completed', 'North America'),
            (4, 104, 'Home', 150.0, 'cancelled', 'Asia'),
            (5, 105, 'Clothing', 80.0, 'completed', 'North America'),
            (6, 106, 'Electronics', 300.0, 'refunded', 'Europe'),
            (7, 107, 'Home', 220.0, 'completed', 'Europe');
    """)
    return engine


@pytest.fixture
def sample_schema():
    return [
        {"name": "order_id", "type": "INTEGER"},
        {"name": "customer_id", "type": "INTEGER"},
        {"name": "category", "type": "VARCHAR"},
        {"name": "amount", "type": "DOUBLE"},
        {"name": "status", "type": "VARCHAR"},
        {"name": "region", "type": "VARCHAR"},
    ]


@pytest.mark.asyncio
async def test_c2_1_aggregation_query(sales_engine, sample_schema):
    """Test 1: Aggregation query (e.g. total revenue from completed orders)."""
    mock_resp = """
    {
        "sql": "SELECT SUM(amount) AS total_revenue, AVG(amount) AS avg_order_val FROM ecom_orders WHERE status = 'completed';",
        "explanation": "Calculates total and average revenue for completed orders."
    }
    """
    provider = MockLLMProvider([mock_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="What is the total revenue and average order value for completed orders?",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["results"]["row_count"] == 1
    # 500 + 50 + 1200 + 80 + 220 = 2050.0
    data = res["results"]["data"][0]
    assert data["total_revenue"] == 2050.0
    assert data["avg_order_val"] == 410.0
    assert res["retries"] == 0


@pytest.mark.asyncio
async def test_c2_2_filtering_query(sales_engine, sample_schema):
    """Test 2: Filtering query (e.g. all orders from Europe with amount > 100)."""
    mock_resp = """
    {
        "sql": "SELECT order_id, category, amount FROM ecom_orders WHERE region = 'Europe' AND amount > 100 ORDER BY amount DESC;",
        "explanation": "Filters for orders in Europe with amount greater than 100."
    }
    """
    provider = MockLLMProvider([mock_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="Show me all orders from Europe over $100",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["results"]["row_count"] == 2
    # Orders 6 (300.0) and 7 (220.0)
    amounts = [row["amount"] for row in res["results"]["data"]]
    assert amounts == [300.0, 220.0]


@pytest.mark.asyncio
async def test_c2_3_grouping_and_ordering_query(sales_engine, sample_schema):
    """Test 3: Grouping and sorting query (e.g. breakdown by category)."""
    mock_resp = """
    {
        "sql": "SELECT category, COUNT(*) as order_count, SUM(amount) as cat_revenue FROM ecom_orders GROUP BY category ORDER BY cat_revenue DESC;",
        "explanation": "Groups orders by category and calculates count and total revenue."
    }
    """
    provider = MockLLMProvider([mock_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="What is the revenue breakdown across different product categories?",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["results"]["row_count"] == 3
    # Categories: Electronics (2000), Home (370), Clothing (130)
    cats = [row["category"] for row in res["results"]["data"]]
    assert cats == ["Electronics", "Home", "Clothing"]


@pytest.mark.asyncio
async def test_c2_4_nonsense_or_unanswerable_question(sales_engine, sample_schema):
    """Test 4: Unanswerable / nonsense question should gracefully explain and not hallucinate."""
    mock_resp = """
    {
        "sql": null,
        "explanation": "The dataset contains order details, categories, and amounts, but has no weather or temperature data to determine if it was raining."
    }
    """
    provider = MockLLMProvider([mock_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="What was the weather in Paris on the day customer 102 ordered?",
        schema=sample_schema,
    )

    assert res["sql"] is None
    assert "no weather or temperature data" in res["explanation"]
    assert res["results"]["success"] is True
    assert res["results"]["row_count"] == 0
    assert res["retries"] == 0


@pytest.mark.asyncio
async def test_c2_5_self_correction_loop(sales_engine, sample_schema):
    """Test 5: Self-correction loop: LLM hallucinates wrong column on turn 1, receives error, corrects on turn 2."""
    # Turn 1: Uses non-existent column 'sales_price' instead of 'amount'
    turn1_resp = """
    {
        "sql": "SELECT category, SUM(sales_price) as total FROM ecom_orders GROUP BY category;",
        "explanation": "Calculates sum of sales price by category."
    }
    """
    # Turn 2 (Self-corrected): Fixes column name to 'amount'
    turn2_resp = """
    {
        "sql": "SELECT category, SUM(amount) as total FROM ecom_orders GROUP BY category ORDER BY total DESC;",
        "explanation": "Corrected column name from sales_price to amount."
    }
    """
    provider = MockLLMProvider([turn1_resp, turn2_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="What is the total sales by category?",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["retries"] == 1
    assert provider.call_count == 2
    # Verify second prompt received the error message
    second_call_user_prompt = provider.received_prompts[1]["user"]
    assert "sales_price" in second_call_user_prompt or "Error" in second_call_user_prompt
    assert res["sql"] == "SELECT category, SUM(amount) as total FROM ecom_orders GROUP BY category ORDER BY total DESC;"


@pytest.mark.asyncio
async def test_c2_security_rejection_of_hallucinated_admin_commands(sales_engine, sample_schema):
    """Hallucinated destructive/external statements (e.g. ATTACH, COPY, read_csv) are rejected by allowlist."""
    turn1_bad = """
    {
        "sql": "COPY ecom_orders TO '/tmp/dump.csv';",
        "explanation": "Dumping table to file"
    }
    """
    turn2_bad = """
    {
        "sql": "ATTACH 'database.db';",
        "explanation": "Attaching external database"
    }
    """
    turn3_bad = """
    {
        "sql": "INSTALL httpfs;",
        "explanation": "Installing extension"
    }
    """
    provider = MockLLMProvider([turn1_bad, turn2_bad, turn3_bad])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="Export this dataset to my disk",
        schema=sample_schema,
        max_retries=2,
    )

    assert res["results"]["success"] is False
    assert "Validation Error" in res["results"]["error"]
    assert res["retries"] == 2


@pytest.mark.asyncio
async def test_c2_llm_json_array_response_handling(sales_engine, sample_schema):
    """When LLM returns an array of objects e.g. [{"sql": "SELECT ...", "explanation": "..."}], analyst extracts valid SQL."""
    mock_array_resp = """
    [
        {
            "sql": "SELECT category, count(*) as count FROM ecom_orders GROUP BY category;",
            "explanation": "Category counts"
        }
    ]
    """
    provider = MockLLMProvider([mock_array_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="Breakdown of orders per category",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["results"]["row_count"] == 3
    assert "SELECT category" in res["sql"]
    assert res["retries"] == 0


@pytest.mark.asyncio
async def test_c2_llm_nested_list_sql_handling(sales_engine, sample_schema):
    """When LLM returns sql field as a list or nested structure, analyst extracts the query string."""
    mock_nested_resp = """
    {
        "sql": ["SELECT MAX(amount) as max_amount FROM ecom_orders;"],
        "explanation": "Find max amount"
    }
    """
    provider = MockLLMProvider([mock_nested_resp])
    executor = QueryExecutor(sales_engine)
    analyst = ConversationalAnalyst(executor, provider)

    res = await analyst.analyze(
        view_name="ecom_orders",
        question="What was the largest order amount?",
        schema=sample_schema,
    )

    assert res["results"]["success"] is True
    assert res["results"]["data"][0]["max_amount"] == 1200.0
    assert res["retries"] == 0


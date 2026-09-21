"""Strata Command Line Interface (CLI)."""

import typer
from rich.console import Console
from rich.table import Table
from strata.client import StrataClient

app = typer.Typer(help="Strata CLI — The AI-Native Data Science Studio & Version Control System")
console = Console()


@app.command()
def preview(file_path: str):
    """Preview a dataset file (CSV, Excel, Parquet, PubChem, GeoJSON)."""
    console.print(f"[bold green]Inspecting:[/bold green] {file_path}")
    client = StrataClient()
    try:
        data = client.preview_file(file_path)
        table = Table(title=f"Dataset: {data['filename']} ({data['format']})")
        for col in data["schema_fields"][:6]:
            table.add_column(col["name"], style="cyan")

        for row in data["preview_rows"][:5]:
            table.add_row(*[str(row.get(col["name"], "")) for col in data["schema_fields"][:6]])

        console.print(table)
        console.print(f"[dim]Total rows: {data['total_rows']} | Columns: {data['total_columns']}[/dim]")
    except Exception as e:
        console.print(f"[bold red]Error previewing file:[/bold red] {e}")


@app.command()
def version():
    """Show CLI version."""
    console.print("[bold cyan]Strata CLI[/bold cyan] v0.1.0")


def main():
    app()


if __name__ == "__main__":
    main()

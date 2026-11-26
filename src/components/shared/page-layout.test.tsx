import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContentPanel, PageHeader } from "./page-layout";

describe("reference-inspired shared page layout", () => {
  it("renders a compact page title, breadcrumb and description", () => {
    render(
      <PageHeader
        title="Service Report"
        breadcrumb={["Dashboard", "Service Report"]}
        description="Review service activity and status"
      />
    );

    expect(screen.getByRole("heading", { name: "Service Report" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Review service activity and status")).toBeInTheDocument();
  });

  it("renders the content panel title, toolbar and body", () => {
    render(
      <ContentPanel title="Records" toolbar={<button type="button">Export</button>}>
        <p>Service records appear here</p>
      </ContentPanel>
    );

    expect(screen.getByRole("heading", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("Service records appear here")).toBeInTheDocument();
  });
});

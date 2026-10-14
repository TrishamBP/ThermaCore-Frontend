import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { MetricValue } from "@/components/shared/MetricValue";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/errors";

import { ErrorBanner } from "./ErrorBanner";
import { QueryView } from "./QueryView";

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

function Probe({ fn }: { fn: () => Promise<string> }) {
  const q = useQuery({ queryKey: ["probe", fn], queryFn: fn });
  return <QueryView query={q} errorTitle="Load failed">{(d) => <p>data: {d}</p>}</QueryView>;
}

describe("QueryView states", () => {
  it("shows a loading skeleton, then data", async () => {
    wrap(<Probe fn={async () => "ok"} />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(await screen.findByText("data: ok")).toBeInTheDocument();
  });

  it("shows the error code, request id and a retry action", async () => {
    const fn = vi.fn(async (): Promise<string> => {
      throw new ApiError({ status: 503, code: "database_unavailable", message: "Telemetry store is unavailable", requestId: "abc123" });
    });
    wrap(<Probe fn={fn} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Load failed");
    expect(screen.getByText(/database_unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("value and status rendering", () => {
  it("renders null as an explained dash, never 0", () => {
    render(<MetricValue value={null} unit="percent" reason="not applicable (null) for non-GPU assets" label="GPU utilization" />);
    const el = screen.getByLabelText("GPU utilization: not applicable (null) for non-GPU assets");
    expect(el).toHaveTextContent("—");
    expect(el).not.toHaveTextContent("0");
  });

  it("status badges carry text, not just colour", () => {
    render(<StatusBadge status="APPROACHING_LIMIT" />);
    expect(screen.getByText("Approaching limit")).toBeInTheDocument();
  });

  it("error banner works with non-API errors", () => {
    render(<ErrorBanner error={new Error("boom")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });
});

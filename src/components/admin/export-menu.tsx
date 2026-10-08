"use client";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ExportMenu({ sessionId, winnersOnly = false, label = "Export" }: { sessionId: string; winnersOnly?: boolean; label?: string }) {
  const q = winnersOnly ? "&winners=1" : "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Download data-icon="inline-start" /> {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<a href={`/api/sessions/${sessionId}/export?format=csv${q}`} />}><FileText /> CSV</DropdownMenuItem>
        <DropdownMenuItem render={<a href={`/api/sessions/${sessionId}/export?format=xlsx${q}`} />}><FileSpreadsheet /> Excel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

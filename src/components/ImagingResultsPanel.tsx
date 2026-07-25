import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileImage, Plus, X, Image as ImageIcon } from "lucide-react";

export interface ImagingItem {
  id: string;
  type: string;
  body_part: string;
  result_summary: string;
  imaging_date: string;
  facility: string;
  file_name?: string;
  status: "Normal" | "Abnormal" | "Pending";
}

interface ImagingResultsPanelProps {
  imagingList: ImagingItem[];
  onUpdateImaging: (list: ImagingItem[]) => void;
}

export function ImagingResultsPanel({ imagingList, onUpdateImaging }: ImagingResultsPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newScan, setNewScan] = useState<Partial<ImagingItem>>({
    type: "X-Ray",
    body_part: "",
    result_summary: "",
    imaging_date: new Date().toISOString().split("T")[0],
    facility: "",
    status: "Normal",
  });

  const filtered = filterType === "all" ? imagingList : imagingList.filter((item) => item.type === filterType);

  const addImaging = () => {
    if (!newScan.type || !newScan.body_part) return;
    const item: ImagingItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: newScan.type,
      body_part: newScan.body_part,
      result_summary: newScan.result_summary || "No summary provided",
      imaging_date: newScan.imaging_date || new Date().toISOString().split("T")[0],
      facility: newScan.facility || "Hospital Diagnostic Center",
      status: (newScan.status as "Normal" | "Abnormal" | "Pending") || "Normal",
    };
    onUpdateImaging([...imagingList, item]);
    setNewScan({
      type: "X-Ray",
      body_part: "",
      result_summary: "",
      imaging_date: new Date().toISOString().split("T")[0],
      facility: "",
      status: "Normal",
    });
    setShowAddForm(false);
  };

  const removeImaging = (id: string) => {
    onUpdateImaging(imagingList.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filter Modality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modalities</SelectItem>
              <SelectItem value="X-Ray">X-Ray</SelectItem>
              <SelectItem value="CT Scan">CT Scan</SelectItem>
              <SelectItem value="MRI">MRI</SelectItem>
              <SelectItem value="Ultrasound">Ultrasound</SelectItem>
              <SelectItem value="ECG/EKG">ECG / EKG</SelectItem>
              <SelectItem value="Echocardiogram">Echocardiogram</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm((v) => !v)}
          className="text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Imaging Record
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">New Imaging Record</h4>
            <div className="grid sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">Modality</label>
                <Select
                  value={newScan.type}
                  onValueChange={(val) => setNewScan((p) => ({ ...p, type: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X-Ray">X-Ray</SelectItem>
                    <SelectItem value="CT Scan">CT Scan</SelectItem>
                    <SelectItem value="MRI">MRI</SelectItem>
                    <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="ECG/EKG">ECG / EKG</SelectItem>
                    <SelectItem value="Echocardiogram">Echocardiogram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Body Part / Region</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Chest, Brain, Abdomen"
                  value={newScan.body_part}
                  onChange={(e) => setNewScan((p) => ({ ...p, body_part: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Status</label>
                <Select
                  value={newScan.status}
                  onValueChange={(val) => setNewScan((p) => ({ ...p, status: val as "Normal" | "Abnormal" | "Pending" }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Abnormal">Abnormal</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">Findings / Summary</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Key radiological findings..."
                  value={newScan.result_summary}
                  onChange={(e) => setNewScan((p) => ({ ...p, result_summary: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">Imaging Facility</label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Imaging center name"
                  value={newScan.facility}
                  onChange={(e) => setNewScan((p) => ({ ...p, facility: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" variant="hero" className="h-7 text-xs" onClick={addImaging}>
                Save Record
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          <ImageIcon className="h-8 w-8 mx-auto opacity-40 mb-2" />
          <p>No imaging results available.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((item) => (
            <Card key={item.id} className="relative shadow-sm border border-border">
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">
                        {item.type} — {item.body_part}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{item.imaging_date} • {item.facility}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold ${
                        item.status === "Abnormal"
                          ? "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400"
                          : item.status === "Pending"
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400"
                          : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                      }`}
                    >
                      {item.status}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeImaging(item.id)}
                      className="text-muted-foreground hover:text-destructive p-1 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/50 p-2 rounded text-[11px]">
                  {item.result_summary}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

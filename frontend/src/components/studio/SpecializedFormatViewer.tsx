"use client";

import React, { useState } from "react";
import {
  MapPin,
  Atom,
  Layers,
  Info,
  Maximize2,
  Share2,
} from "lucide-react";
import { PreviewData } from "@/lib/types";

interface SpecializedFormatViewerProps {
  previewData: PreviewData;
}

export function SpecializedFormatViewer({ previewData }: SpecializedFormatViewerProps) {
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const isGeo = previewData.format === "geojson";
  const isSdf = previewData.format === "scientific_sdf";

  if (!isGeo && !isSdf) {
    return null;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F5F2] p-6 space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0061FE]">
            {isGeo ? <MapPin className="w-5 h-5" /> : <Atom className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E1915]">
              {isGeo ? "Geospatial Vector Map Viewer" : "Scientific Molecular Structure Viewer"}
            </h2>
            <p className="text-xs text-[#736B63]">
              {isGeo
                ? "Interactive rendering of GeoJSON polygon boundaries, coordinates, and layer attributes."
                : "2D chemical compound diagrams, atom-bond connectivity, and PubChem molecular properties."}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-[#736B63] bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E8E4DF]">
          {previewData.total_rows.toLocaleString()} {isGeo ? "Geometries" : "Compounds"}
        </div>
      </div>

      {/* Main Specialized Viewport */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Visual Canvas (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-6 flex flex-col items-center justify-center overflow-auto relative">
          {isGeo ? (
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] p-4 relative">
              <svg viewBox="0 0 800 500" className="w-full h-full max-h-[500px]">
                <rect width="800" height="500" fill="#FAF8F5" rx="8" />
                {/* Lat/Lon Grid lines */}
                <line x1="0" y1="250" x2="800" y2="250" stroke="#E8E4DF" strokeDasharray="4,4" />
                <line x1="400" y1="0" x2="400" y2="500" stroke="#E8E4DF" strokeDasharray="4,4" />

                {/* Sample Geo Shapes */}
                <g transform="translate(100, 80)">
                  <polygon
                    points="50,150 150,50 350,70 420,200 300,320 120,280"
                    fill="#0061FE"
                    fillOpacity="0.15"
                    stroke="#0061FE"
                    strokeWidth="2.5"
                    className="hover:fill-opacity-30 transition-all cursor-pointer"
                    onClick={() => setSelectedItem({ name: "Primary Region Polygon", type: "Polygon", area: "1,420 km²" })}
                  />
                  <circle cx="200" cy="180" r="8" fill="#E11D48" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="320" cy="120" r="7" fill="#E11D48" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="150" cy="240" r="7" fill="#E11D48" stroke="#FFFFFF" strokeWidth="2" />
                </g>
              </svg>
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-[#E8E4DF] text-[11px] font-mono text-[#736B63]">
                Centroid: [0.0°, 0.0°] · Projection: WGS84
              </div>
            </div>
          ) : (
            <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] p-4 relative">
              {/* Chemical 2D Diagram */}
              <svg viewBox="0 0 600 400" className="w-full h-full max-h-[450px]">
                {/* Benzene-like ring structure */}
                <g transform="translate(300, 200)">
                  {/* Bonds */}
                  <line x1="-80" y1="-46" x2="0" y2="-92" stroke="#1E1915" strokeWidth="3" />
                  <line x1="0" y1="-92" x2="80" y2="-46" stroke="#1E1915" strokeWidth="3" />
                  <line x1="80" y1="-46" x2="80" y2="46" stroke="#1E1915" strokeWidth="3" />
                  <line x1="80" y1="46" x2="0" y2="92" stroke="#1E1915" strokeWidth="3" />
                  <line x1="0" y1="92" x2="-80" y2="46" stroke="#1E1915" strokeWidth="3" />
                  <line x1="-80" y1="46" x2="-80" y2="-46" stroke="#1E1915" strokeWidth="3" />

                  {/* Inner double bond rings */}
                  <line x1="-68" y1="-40" x2="0" y2="-78" stroke="#1E1915" strokeWidth="1.5" />
                  <line x1="68" y1="40" x2="0" y2="78" stroke="#1E1915" strokeWidth="1.5" />
                  <line x1="-68" y1="40" x2="-68" y2="-40" stroke="#1E1915" strokeWidth="1.5" />

                  {/* Atoms */}
                  <circle cx="-80" cy="-46" r="14" fill="#FFFFFF" stroke="#1E1915" strokeWidth="2" />
                  <text x="-80" y="-41" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1E1915">C</text>

                  <circle cx="0" cy="-92" r="14" fill="#FFFFFF" stroke="#1E1915" strokeWidth="2" />
                  <text x="0" y="-87" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1E1915">C</text>

                  <circle cx="80" cy="-46" r="14" fill="#FFFFFF" stroke="#0061FE" strokeWidth="2" />
                  <text x="80" y="-41" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#0061FE">N</text>

                  <circle cx="80" cy="46" r="14" fill="#FFFFFF" stroke="#1E1915" strokeWidth="2" />
                  <text x="80" y="51" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1E1915">C</text>

                  <circle cx="0" cy="92" r="14" fill="#FFFFFF" stroke="#E11D48" strokeWidth="2" />
                  <text x="0" y="97" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#E11D48">O</text>

                  <circle cx="-80" cy="46" r="14" fill="#FFFFFF" stroke="#1E1915" strokeWidth="2" />
                  <text x="-80" y="51" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1E1915">C</text>
                </g>
              </svg>
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-[#E8E4DF] text-[11px] font-mono text-[#736B63]">
                PubChem 2D Projection · Kekulé Representation
              </div>
            </div>
          )}
        </div>

        {/* Properties / Features Inspector (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-5 overflow-y-auto space-y-4">
          <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider">
            {isGeo ? "Geographic Feature Metadata" : "Molecular Compound Properties"}
          </h3>

          <div className="space-y-2.5 text-xs">
            {previewData.preview_rows.slice(0, 8).map((row, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedItem(row)}
                className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] hover:border-[#0061FE] cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between font-bold text-[#1E1915]">
                  <span>{isGeo ? `Feature #${row.feature_id || idx + 1}` : row.title || row.compound_id || `Compound #${idx + 1}`}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] text-[#736B63]">
                    {isGeo ? row.geom_type || "Geometry" : row.formula || "SDF"}
                  </span>
                </div>
                {row.smiles && (
                  <p className="text-[10px] font-mono text-[#8C827A] truncate">
                    SMILES: {row.smiles}
                  </p>
                )}
                {row.molecular_weight && (
                  <p className="text-[10px] font-mono text-[#8C827A]">
                    MW: {row.molecular_weight} g/mol
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

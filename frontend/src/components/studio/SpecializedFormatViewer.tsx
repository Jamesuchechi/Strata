"use client";

import React, { useState, useMemo } from "react";
import {
  MapPin,
  Atom,
  Layers,
  Info,
  Compass,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Binary,
  ZoomIn,
} from "lucide-react";
import { PreviewData } from "@/lib/types";

interface SpecializedFormatViewerProps {
  previewData: PreviewData;
}

export function SpecializedFormatViewer({ previewData }: SpecializedFormatViewerProps) {
  const isGeo = previewData.format === "geojson";
  const isSdf = previewData.format === "scientific_sdf";

  const [selectedGeoIndex, setSelectedGeoIndex] = useState<number>(0);
  const [selectedMolIndex, setSelectedMolIndex] = useState<number>(0);

  // Scientific data
  const molecules = previewData.molecules_data || [];
  const currentMol = molecules[selectedMolIndex] || (previewData.preview_rows?.[selectedMolIndex] as any);

  // Geospatial data
  const geoMetadata = previewData.geo_metadata;
  const sampleGeometries = geoMetadata?.sample_geometries || [];
  const currentGeo = sampleGeometries[selectedGeoIndex] || (previewData.preview_rows?.[selectedGeoIndex] as any);

  if (!isGeo && !isSdf) {
    return null;
  }

  // Atom element color mapping
  const getElementColor = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case "C":
        return { bg: "#262626", text: "#FFFFFF", stroke: "#171717" };
      case "O":
        return { bg: "#E11D48", text: "#FFFFFF", stroke: "#BE123C" };
      case "N":
        return { bg: "#0061FE", text: "#FFFFFF", stroke: "#004ECC" };
      case "S":
        return { bg: "#D97706", text: "#FFFFFF", stroke: "#B45309" };
      case "CL":
      case "F":
      case "BR":
      case "I":
        return { bg: "#059669", text: "#FFFFFF", stroke: "#047857" };
      case "P":
        return { bg: "#7C3AED", text: "#FFFFFF", stroke: "#6D28D9" };
      default:
        return { bg: "#4B5563", text: "#FFFFFF", stroke: "#374151" };
    }
  };

  // Normalized 2D coordinates for current molecule
  const normalizedAtoms = useMemo(() => {
    if (!currentMol || !currentMol.atoms || currentMol.atoms.length === 0) return [];
    const atoms = currentMol.atoms;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const a of atoms) {
      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
    }
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const padding = 60;
    const canvasWidth = 560;
    const canvasHeight = 360;

    const scale = Math.min((canvasWidth - 2 * padding) / width, (canvasHeight - 2 * padding) / height);
    const offsetX = (canvasWidth - width * scale) / 2;
    const offsetY = (canvasHeight - height * scale) / 2;

    return atoms.map((a: any) => ({
      ...a,
      svgX: offsetX + (a.x - minX) * scale,
      svgY: canvasHeight - (offsetY + (a.y - minY) * scale), // invert Y for SVG standard
    }));
  }, [currentMol]);

  // Scaled GeoJSON bounds projection
  const projectedGeometries = useMemo(() => {
    if (!geoMetadata || !geoMetadata.bounds) return [];
    const [minLon, minLat, maxLon, maxLat] = geoMetadata.bounds;
    const width = maxLon - minLon || 0.01;
    const height = maxLat - minLat || 0.01;
    const canvasW = 680;
    const canvasH = 400;
    const pad = 40;

    const scaleX = (canvasW - 2 * pad) / width;
    const scaleY = (canvasH - 2 * pad) / height;

    const projectPoint = (lon: number, lat: number) => {
      const x = pad + (lon - minLon) * scaleX;
      const y = canvasH - (pad + (lat - minLat) * scaleY);
      return [x, y];
    };

    return sampleGeometries.map((geom, gIdx) => {
      const coords = geom.coordinates || [];
      const type = geom.type;

      if (type === "Point" && Array.isArray(coords) && coords.length >= 2) {
        const [px, py] = projectPoint(coords[0], coords[1]);
        return { id: geom.id, type, points: `${px},${py}`, cx: px, cy: py, raw: geom };
      }

      if ((type === "Polygon" || type === "MultiPolygon") && Array.isArray(coords)) {
        const rings = type === "Polygon" ? [coords[0]] : coords.map((c: any) => c[0]);
        const svgPaths = rings
          .filter(Boolean)
          .map((ring: any) => {
            if (!Array.isArray(ring)) return "";
            return ring
              .map((pt: any) => {
                if (Array.isArray(pt) && pt.length >= 2) {
                  const [px, py] = projectPoint(pt[0], pt[1]);
                  return `${px},${py}`;
                }
                return "";
              })
              .filter(Boolean)
              .join(" ");
          })
          .filter(Boolean);

        return { id: geom.id, type, svgPaths, raw: geom };
      }

      if (type === "LineString" && Array.isArray(coords)) {
        const pts = coords
          .map((pt: any) => {
            if (Array.isArray(pt) && pt.length >= 2) {
              const [px, py] = projectPoint(pt[0], pt[1]);
              return `${px},${py}`;
            }
            return "";
          })
          .filter(Boolean)
          .join(" ");
        return { id: geom.id, type, linePoints: pts, raw: geom };
      }

      return { id: geom.id, type, raw: geom };
    });
  }, [geoMetadata, sampleGeometries]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F5F2] p-6 space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0061FE]">
            {isGeo ? <MapPin className="w-5 h-5" /> : <Atom className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#1E1915]">
                {isGeo ? "Geospatial Vector Map Viewer" : "Scientific Molecular Structure Viewer"}
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#0061FE]">
                {isGeo ? "GeoPandas & Shapely" : "RDKit Engine"}
              </span>
            </div>
            <p className="text-xs text-[#736B63]">
              {isGeo
                ? `CRS: ${geoMetadata?.crs || "EPSG:4326"} · ${geoMetadata?.valid_geometries_count ?? previewData.total_rows} Valid Geometries validated by Shapely.`
                : "2D atom-bond connectivity, aromaticity, and RDKit-computed physicochemical descriptors."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGeo && geoMetadata?.crs && (
            <span className="text-xs font-mono font-bold text-[#0061FE] bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
              {geoMetadata.crs}
            </span>
          )}
          <div className="text-xs font-mono text-[#736B63] bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E8E4DF]">
            {previewData.total_rows.toLocaleString()} {isGeo ? "Features" : "Compounds"}
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Visual Canvas (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-6 flex flex-col items-center justify-center overflow-auto relative">
          {isGeo ? (
            <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] p-4 relative">
              <svg viewBox="0 0 680 400" className="w-full h-full max-h-[460px]">
                <rect width="680" height="400" fill="#FAF8F5" rx="8" />
                {/* Lat/Lon Grid lines */}
                <line x1="0" y1="200" x2="680" y2="200" stroke="#E8E4DF" strokeDasharray="4,4" />
                <line x1="340" y1="0" x2="340" y2="400" stroke="#E8E4DF" strokeDasharray="4,4" />

                {/* Render Projected Features */}
                {projectedGeometries.map((pg, idx) => {
                  const isSelected = selectedGeoIndex === idx;
                  if (pg.svgPaths && pg.svgPaths.length > 0) {
                    return pg.svgPaths.map((pathPoints, pIdx) => (
                      <polygon
                        key={`${idx}-${pIdx}`}
                        points={pathPoints}
                        fill={isSelected ? "#0061FE" : "#3B82F6"}
                        fillOpacity={isSelected ? 0.35 : 0.15}
                        stroke={isSelected ? "#0061FE" : "#2563EB"}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        className="transition-all cursor-pointer hover:fill-opacity-40"
                        onClick={() => setSelectedGeoIndex(idx)}
                      />
                    ));
                  }
                  if (pg.linePoints) {
                    return (
                      <polyline
                        key={idx}
                        points={pg.linePoints}
                        fill="none"
                        stroke={isSelected ? "#0061FE" : "#2563EB"}
                        strokeWidth={isSelected ? 3 : 2}
                        className="transition-all cursor-pointer hover:stroke-blue-700"
                        onClick={() => setSelectedGeoIndex(idx)}
                      />
                    );
                  }
                  if (pg.cx !== undefined && pg.cy !== undefined) {
                    return (
                      <circle
                        key={idx}
                        cx={pg.cx}
                        cy={pg.cy}
                        r={isSelected ? 8 : 5}
                        fill={isSelected ? "#E11D48" : "#EF4444"}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        className="transition-all cursor-pointer hover:scale-125"
                        onClick={() => setSelectedGeoIndex(idx)}
                      />
                    );
                  }
                  return null;
                })}
              </svg>

              {/* Geo overlay stats */}
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-[#E8E4DF] text-[11px] font-mono text-[#736B63] space-y-0.5 shadow-sm">
                <div>Bounds: [{geoMetadata?.bounds?.join(", ") || "-180, -90, 180, 90"}]</div>
                <div>Centroid: [{geoMetadata?.center?.join(", ") || "0.0, 0.0"}] · Projection: {geoMetadata?.crs || "EPSG:4326"}</div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center bg-[#FAF8F5] rounded-xl border border-[#E8E4DF] p-4 relative">
              {/* RDKit 2D Chemical Diagram */}
              {normalizedAtoms.length > 0 ? (
                <svg viewBox="0 0 560 360" className="w-full h-full max-h-[440px]">
                  {/* Bonds */}
                  {currentMol?.bonds?.map((b: any, idx: number) => {
                    const a1 = normalizedAtoms[b.source - 1];
                    const a2 = normalizedAtoms[b.target - 1];
                    if (!a1 || !a2) return null;
                    const isDouble = b.type === 2;
                    const isTriple = b.type === 3;
                    const isAromatic = b.is_aromatic;

                    return (
                      <g key={idx}>
                        <line
                          x1={a1.svgX}
                          y1={a1.svgY}
                          x2={a2.svgX}
                          y2={a2.svgY}
                          stroke={isAromatic ? "#0061FE" : "#1E1915"}
                          strokeWidth={isTriple ? 4 : isDouble ? 3.5 : 2}
                          strokeDasharray={isAromatic ? "4,2" : undefined}
                        />
                      </g>
                    );
                  })}

                  {/* Atom Nodes */}
                  {normalizedAtoms.map((a: any, idx: number) => {
                    const col = getElementColor(a.symbol);
                    return (
                      <g key={idx} transform={`translate(${a.svgX}, ${a.svgY})`}>
                        <circle
                          cx={0}
                          cy={0}
                          r={13}
                          fill={col.bg}
                          stroke={col.stroke}
                          strokeWidth={2}
                          className="shadow-xs"
                        />
                        <text
                          x={0}
                          y={4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill={col.text}
                          className="select-none pointer-events-none"
                        >
                          {a.symbol}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div className="flex flex-col items-center justify-center text-[#736B63] space-y-2">
                  <Atom className="w-12 h-12 text-[#E8E4DF] animate-pulse" />
                  <p className="text-xs font-medium">Select a compound from the right panel to view 2D chemical structure</p>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl border border-[#E8E4DF] text-[11px] font-mono text-[#736B63] space-y-0.5 shadow-sm">
                <div>Formula: <strong>{currentMol?.formula || "N/A"}</strong> · MW: <strong>{currentMol?.molecular_weight || "N/A"} g/mol</strong></div>
                <div>SMILES: <span className="text-[#0061FE]">{currentMol?.smiles || "N/A"}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Properties / Features Inspector (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E8E4DF] shadow-2xs p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#1E1915] uppercase tracking-wider">
              {isGeo ? "Feature Layers & Properties" : "RDKit Compound Descriptors"}
            </h3>
            <span className="text-[10px] font-mono text-[#736B63]">
              {isGeo ? `${sampleGeometries.length} features` : `${molecules.length || previewData.preview_rows?.length || 0} compounds`}
            </span>
          </div>

          {/* Active Feature / Compound Full Descriptors Card */}
          {isGeo && currentGeo && (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-[#1E1915]">
                <span>Selected Feature #{currentGeo.id || selectedGeoIndex + 1}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[#0061FE]">
                  {currentGeo.type || "Geometry"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#736B63]">
                <div>Status: <span className="font-semibold text-emerald-700">Valid Shapely Geometry</span></div>
                <div>ID: <span className="font-semibold">{currentGeo.id}</span></div>
              </div>
              {currentGeo.properties && Object.keys(currentGeo.properties).length > 0 && (
                <div className="pt-1 border-t border-blue-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#736B63]">Feature Properties</div>
                  {Object.entries(currentGeo.properties).slice(0, 6).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px]">
                      <span className="text-[#736B63] truncate">{k}:</span>
                      <span className="font-medium text-[#1E1915] truncate ml-2">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isGeo && currentMol && (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between font-bold text-[#1E1915]">
                <span className="truncate">{currentMol.title || currentMol.compound_id || "Compound"}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[#0061FE]">
                  {currentMol.formula || "SDF"}
                </span>
              </div>

              {/* RDKit Physicochemical Matrix */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-white p-2 rounded-lg border border-[#E8E4DF]">
                  <div className="text-[10px] text-[#736B63]">Mol Weight</div>
                  <div className="font-bold text-[#1E1915]">{currentMol.molecular_weight || "N/A"}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#E8E4DF]">
                  <div className="text-[10px] text-[#736B63]">LogP (Crippen)</div>
                  <div className="font-bold text-[#1E1915]">{currentMol.log_p ?? "N/A"}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#E8E4DF]">
                  <div className="text-[10px] text-[#736B63]">TPSA (Polar Area)</div>
                  <div className="font-bold text-[#1E1915]">{currentMol.tpsa ?? "N/A"} Å²</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#E8E4DF]">
                  <div className="text-[10px] text-[#736B63]">H-Donors / Acc</div>
                  <div className="font-bold text-[#1E1915]">{currentMol.h_bond_donors ?? 0} / {currentMol.h_bond_acceptors ?? 0}</div>
                </div>
              </div>

              {currentMol.smiles && (
                <div className="bg-white p-2 rounded-lg border border-[#E8E4DF] text-[10px] font-mono break-all text-[#736B63]">
                  <span className="font-bold text-[#1E1915]">SMILES: </span>
                  {currentMol.smiles}
                </div>
              )}
            </div>
          )}

          {/* List of items */}
          <div className="space-y-2 text-xs">
            {(isGeo ? sampleGeometries : molecules).map((item: any, idx: number) => {
              const isSelected = isGeo ? selectedGeoIndex === idx : selectedMolIndex === idx;
              return (
                <div
                  key={idx}
                  onClick={() => isGeo ? setSelectedGeoIndex(idx) : setSelectedMolIndex(idx)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all space-y-1 ${
                    isSelected
                      ? "bg-white border-[#0061FE] shadow-sm ring-1 ring-[#0061FE]/20"
                      : "bg-[#FAF8F5] border-[#E8E4DF] hover:border-[#8C827A]"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[#1E1915]">
                    <span className="truncate">
                      {isGeo ? `Feature #${item.id || idx + 1}` : item.title || item.compound_id || `Compound #${idx + 1}`}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-[#E8E4DF] text-[#736B63]">
                      {isGeo ? item.type || "Geometry" : item.formula || "SDF"}
                    </span>
                  </div>
                  {!isGeo && item.molecular_weight && (
                    <div className="flex justify-between text-[10px] font-mono text-[#8C827A]">
                      <span>MW: {item.molecular_weight} g/mol</span>
                      {item.log_p !== undefined && <span>LogP: {item.log_p}</span>}
                    </div>
                  )}
                  {isGeo && item.properties && (
                    <div className="text-[10px] font-mono text-[#8C827A] truncate">
                      {Object.entries(item.properties).map(([k, v]) => `${k}=${v}`).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

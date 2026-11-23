import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    MapContainer, TileLayer, CircleMarker, Polygon,
    Polyline, useMapEvents, Popup, Marker, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import storeAuth from '../../context/storeAuth';
import 'pannellum/build/pannellum.css'
import 'pannellum/build/pannellum.js'

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORY_CONFIG = {
    academico:       { color: '#1B6BB0', label: 'Académico' },
    biblioteca:      { color: '#7C3AED', label: 'Biblioteca' },
    servicios:       { color: '#059669', label: 'Servicios' },
    deportes:        { color: '#DC2626', label: 'Deportes' },
    eventos:         { color: '#F59E0B', label: 'Eventos' },
    estacionamiento: { color: '#6B7280', label: 'Estacionamiento' },
    entrada:         { color: '#0EA5E9', label: 'Entrada' },
    otro:            { color: '#9CA3AF', label: 'Otro' },
};

function createPoiIcon(category) {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.otro;
    return L.divIcon({
        className: '',
        html: `<div style="background:${config.color};color:#fff;padding:5px 9px;border-radius:8px;border:2.5px solid #fff;font-weight:800;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;">${config.label.charAt(0)}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

const newPoiIcon = L.divIcon({
    className: '',
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));"><svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.234 22.75 15.265 23.648a1 1 0 001.47 0C17.766 38.75 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#FFB81C"/><circle cx="16" cy="16" r="7" fill="#fff"/><circle cx="16" cy="16" r="4" fill="#FFB81C"/></svg></div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
});

function haversineDistance(a, b) {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const CLUSTER_RADIUS_M = 80;

function clusterPois(pois, zoomLevel) {
    if (zoomLevel >= 16 || pois.length < 8) return pois.map(p => ({ ...p, _isCluster: false }));
    const clusters = [];
    const assigned = new Set();
    pois.forEach((poi, i) => {
        if (assigned.has(i)) return;
        const group = [poi];
        assigned.add(i);
        pois.forEach((other, j) => {
            if (assigned.has(j)) return;
            const dist = haversineDistance({ lat: poi.latitud, lng: poi.longitud }, { lat: other.latitud, lng: other.longitud });
            if (dist <= CLUSTER_RADIUS_M) { group.push(other); assigned.add(j); }
        });
        if (group.length === 1) {
            clusters.push({ ...poi, _isCluster: false });
        } else {
            const centerLat = group.reduce((s, p) => s + p.latitud, 0) / group.length;
            const centerLng = group.reduce((s, p) => s + p.longitud, 0) / group.length;
            clusters.push({ _isCluster: true, _count: group.length, _topCategory: group[0].categoria, latitud: centerLat, longitud: centerLng, nombre: `${group.length} lugares`, _items: group });
        }
    });
    return clusters;
}

async function geocodeAddress(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ec`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    return res.json();
}

async function getOsrmRoute(origin, destination) {
    const url = `https://router.project-osrm.org/route/v1/walking/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) throw new Error('Sin ruta');
    return {
        waypoints: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: Math.round(route.distance),
        duration: Math.round(route.duration),
    };
}

function parseTxtRoutes(text) {
    const lines = text.split('\n').map(l => l.trim());
    const rutas = [];
    let current = null;
    let errors = [];
    lines.forEach((line, idx) => {
        if (!line) return;
        if (line.toUpperCase().startsWith('RUTA:')) {
            if (current) rutas.push(current);
            const nombre = line.slice(5).trim();
            if (!nombre) { errors.push(`Línea ${idx + 1}: RUTA sin nombre`); current = null; return; }
            current = { nombre, color: '#3b82f6', stops: [] };
        } else if (line.toUpperCase().startsWith('COLOR:')) {
            if (!current) { errors.push(`Línea ${idx + 1}: COLOR fuera de una RUTA`); return; }
            const color = line.slice(6).trim();
            if (/^#[0-9a-fA-F]{3,6}$/.test(color)) { current.color = color; }
            else { errors.push(`Línea ${idx + 1}: COLOR inválido "${color}", usando default`); }
        } else if (line.toUpperCase().startsWith('PARADA:')) {
            if (!current) { errors.push(`Línea ${idx + 1}: PARADA fuera de una RUTA`); return; }
            const raw = line.slice(7).trim();
            const usePipe = raw.includes('|');
            const parts = usePipe ? raw.split('|').map(p => p.trim()) : raw.split(',').map(p => p.trim());
            if (parts.length < 3) { errors.push(`Línea ${idx + 1}: PARADA mal formateada`); return; }
            const nombre = usePipe ? parts[0] : parts.slice(0, parts.length - 2).join(',').trim();
            const lat = parseFloat(usePipe ? parts[1] : parts[parts.length - 2]);
            const lng = parseFloat(usePipe ? parts[2] : parts[parts.length - 1]);
            if (isNaN(lat) || isNaN(lng)) { errors.push(`Línea ${idx + 1}: coordenadas inválidas`); return; }
            current.stops.push({ nombre, lat, lng, orden: current.stops.length });
        } else {
            if (!line.startsWith('#')) errors.push(`Línea ${idx + 1}: formato no reconocido "${line.slice(0, 40)}..."`);
        }
    });
    if (current) rutas.push(current);
    const validRoutes = rutas.filter(r => r.stops.length >= 2);
    const skipped = rutas.length - validRoutes.length;
    if (skipped > 0) errors.push(`${skipped} ruta(s) ignoradas por tener menos de 2 paradas`);
    return { rutas: validRoutes, errors };
}

function MapClickHandler({ mode, onAddStop, onSetDestination, onAddPoiCoord }) {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            if (mode === 'addStop') onAddStop([lat, lng]);
            else if (mode === 'setDest') onSetDestination([lat, lng]);
            else if (mode === 'addPoi') onAddPoiCoord({ lat, lng });
        },
    });
    return null;
}

function FlyTo({ center, zoom = 17, ts }) {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, zoom, { duration: 1 });
    }, [center, zoom, map, ts]);
    return null;
}

function Viewer360({ imageUrl, onClose }) {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [brightness, setBrightness] = useState(105);
    const [contrast, setContrast] = useState(108);
    const [saturation, setSaturation] = useState(105);
    const [showControls, setShowControls] = useState(false);

    const applyFilter = useCallback((b, c, s) => {
        if (!containerRef.current) return;
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) canvas.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    }, []);

    useEffect(() => {
        if (!imageUrl || !containerRef.current) return

        viewerRef.current = window.pannellum.viewer(containerRef.current, {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            showControls: true,
            compass: false,
            friction: 0.15,
            mouseZoom: true,
            hfov: 85,
            yaw: 0,
            pitch: -10,
            minHfov: 70,
            maxHfov: 140,
            crossOrigin: 'anonymous',
        })
        viewerRef.current.on('load', () => applyFilter(brightness, contrast, saturation))

        return () => {
            try { viewerRef.current?.destroy() } catch { /* ya destruido */ }
            viewerRef.current = null
        }
    }, [imageUrl])

    useEffect(() => { applyFilter(brightness, contrast, saturation); }, [brightness, contrast, saturation, applyFilter]);

    const sliderRow = (label, value, setter, min, max) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ fontSize: 11, color: '#cbd5e1', width: 70, flexShrink: 0 }}>{label}</span>
            <input type="range" min={min} max={max} value={value} onChange={e => setter(Number(e.target.value))} style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', width: 36, textAlign: 'right' }}>{value}%</span>
            <button onClick={() => setter(100)} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 4, fontSize: 10, padding: '1px 5px', cursor: 'pointer' }}>↺</button>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#e0f2fe', fontWeight: 700, fontSize: 14 }}>🔭 Vista 360°</span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowControls(v => !v)} style={{ background: showControls ? '#0369a1' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🎛️ Visibilidad</button>
                    <button onClick={onClose} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕ Cerrar</button>
                </div>
            </div>
            {showControls && (
                <div style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Ajustes de imagen</span>
                        <button onClick={() => { setBrightness(115); setContrast(110); setSaturation(115); }} style={{ background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>↺ Restablecer todo</button>
                    </div>
                    {sliderRow('☀️ Brillo', brightness, setBrightness, 50, 200)}
                    {sliderRow('◑ Contraste', contrast, setContrast, 50, 200)}
                    {sliderRow('🎨 Saturación', saturation, setSaturation, 0, 200)}
                </div>
            )}
            <div ref={containerRef} style={{ flex: 1, width: '100%', filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` }} />
        </div>
    );
}

function PoiForm({ coord, editingPoi, isLoading, onSubmit, onCancel, onCoordChange }) {
    const [name, setName] = useState(editingPoi?.nombre || '');
    const [description, setDesc] = useState(editingPoi?.descripcion || '');
    const [category, setCategory] = useState(editingPoi?.categoria || 'academico');
    const [imagen, setImagen] = useState(editingPoi?.imagen || '');
    const [imagePreview, setImagePreview] = useState(editingPoi?.imagen || '');
    const [imageMode, setImageMode] = useState('url');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [coordError, setCoordError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (editingPoi) {
            setName(editingPoi.nombre || ''); setDesc(editingPoi.descripcion || '');
            setCategory(editingPoi.categoria || 'academico'); setImagen(editingPoi.imagen || '');
            setImagePreview(editingPoi.imagen || '');
            setLat(editingPoi.latitud?.toString() || ''); setLng(editingPoi.longitud?.toString() || '');
        }
    }, [editingPoi]);

    useEffect(() => {
        if (coord && !editingPoi) { setLat(coord.lat.toFixed(6)); setLng(coord.lng.toFixed(6)); }
    }, [coord, editingPoi]);

    useEffect(() => {
        const latN = parseFloat(lat), lngN = parseFloat(lng);
        if (!isNaN(latN) && !isNaN(lngN) && latN >= -90 && latN <= 90 && lngN >= -180 && lngN <= 180) {
            onCoordChange?.({ lat: latN, lng: lngN });
        }
    }, [lat, lng]);

    const validateCoords = () => {
        const latN = parseFloat(lat), lngN = parseFloat(lng);
        if (isNaN(latN) || isNaN(lngN)) return 'Las coordenadas deben ser números válidos';
        if (latN < -90 || latN > 90) return 'Latitud debe estar entre -90 y 90';
        if (lngN < -180 || lngN > 180) return 'Longitud debe estar entre -180 y 180';
        return '';
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Solo se permiten archivos de imagen'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => { const b64 = ev.target.result; setImagen(b64); setImagePreview(b64); };
        reader.readAsDataURL(file);
    };

    const handleUrlChange = (val) => { setImagen(val); setImagePreview(val); };
    const clearImage = () => { setImagen(''); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const err = validateCoords();
        if (err) { setCoordError(err); return; }
        setCoordError('');
        onSubmit({ nombre: name.trim(), descripcion: description.trim() || undefined, categoria: category, latitud: parseFloat(lat), longitud: parseFloat(lng), imagen: imagen || undefined });
    };

    const latValid = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, color: '#1e40af', fontWeight: 700, fontSize: 14 }}>{editingPoi ? '✏️ Editar Ubicación' : '📍 Nueva Ubicación'}</h3>
            <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 10, border: '1.5px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>📌 Coordenadas</span>
                    <span style={{ fontSize: 10, color: '#6b7280' }}>Edita o toca el mapa</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Latitud *</label>
                        <input value={lat} onChange={e => { setLat(e.target.value); setCoordError(''); }} placeholder="-0.210000" style={{ ...inputStyle, fontSize: 12, borderColor: coordError ? '#f87171' : '#d1d5db', background: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Longitud *</label>
                        <input value={lng} onChange={e => { setLng(e.target.value); setCoordError(''); }} placeholder="-78.489000" style={{ ...inputStyle, fontSize: 12, borderColor: coordError ? '#f87171' : '#d1d5db', background: '#fff' }} />
                    </div>
                </div>
                {coordError && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, background: '#fef2f2', borderRadius: 6, padding: '4px 8px', border: '1px solid #fca5a5' }}>⚠️ {coordError}</div>}
                {!coordError && latValid && <div style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>✅ {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Nombre *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Laboratorio de Cómputo" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Descripción</label>
                <textarea value={description} onChange={e => setDesc(e.target.value)} placeholder="Descripción del lugar..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Categoría</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <button key={key} type="button" onClick={() => setCategory(key)} style={{ padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1.5px solid ${category === key ? cfg.color : '#e5e7eb'}`, background: category === key ? cfg.color : '#fff', color: category === key ? '#fff' : '#374151', cursor: 'pointer' }}>{cfg.label}</button>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#f0f9ff', borderRadius: 8, padding: 10, border: '1.5px solid #bae6fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>🔭 Imagen 360° (opcional)</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {['url', 'upload'].map(m => (
                            <button key={m} type="button" onClick={() => setImageMode(m)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer', background: imageMode === m ? '#0369a1' : '#e0f2fe', color: imageMode === m ? '#fff' : '#0369a1' }}>{m === 'url' ? '🔗 URL' : '📂 Archivo'}</button>
                        ))}
                    </div>
                </div>
                {imageMode === 'url' ? (
                    <input value={imagen.startsWith('data:') ? '' : imagen} onChange={e => handleUrlChange(e.target.value)} placeholder="https://ejemplo.com/imagen-360.jpg" style={{ ...inputStyle, fontSize: 11 }} />
                ) : (
                    <div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #7dd3fc', borderRadius: 8, padding: '10px', textAlign: 'center', cursor: 'pointer', background: imagePreview ? '#e0f2fe' : '#fff' }}>
                            {imagePreview ? <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 600 }}>✅ Imagen cargada — clic para cambiar</span> : <span style={{ fontSize: 11, color: '#7dd3fc', fontWeight: 600 }}>📷 Clic para seleccionar imagen</span>}
                        </div>
                    </div>
                )}
                {imagePreview && (
                    <div style={{ position: 'relative' }}>
                        <img src={imagePreview} alt="Preview 360" style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid #bae6fd' }} onError={() => setImagePreview('')} />
                        <button type="button" onClick={clearImage} style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>✕</button>
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={isLoading || !name.trim()} style={{ ...btnStyle, background: '#1d4ed8', flex: 1 }}>{isLoading ? '⟳ Guardando…' : editingPoi ? 'Actualizar' : 'Guardar'}</button>
                <button type="button" onClick={onCancel} style={{ ...btnStyle, background: '#6b7280', flex: 1 }}>Cancelar</button>
            </div>
        </form>
    );
}

function ZoneForm({ onSave, onCancel, isLoading }) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#ef4444');
    const [coords, setCoords] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsed = JSON.parse(coords);
            if (!Array.isArray(parsed) || parsed.length < 3) return alert('Mínimo 3 puntos para un polígono');
            const coordinates = parsed.map(c => ({ latitude: c.lat ?? c.latitude, longitude: c.lng ?? c.longitude }));
            onSave({ nombre: name, fill_color: color + '33', stroke_color: color, coordinates });
        } catch { alert('JSON inválido en coordenadas'); }
    };
    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>🗺️ Nueva Zona</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la zona" required style={inputStyle} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Color:</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }} />
            </div>
            <textarea value={coords} onChange={e => setCoords(e.target.value)} placeholder={'[{"lat":-0.21,"lng":-78.49},{"lat":-0.211,"lng":-78.491},{"lat":-0.212,"lng":-78.489}]'} rows={4} style={{ ...inputStyle, resize: 'vertical', fontSize: 11 }} />
            <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={isLoading} style={{ ...btnStyle, background: '#dc2626', flex: 1 }}>{isLoading ? '⟳ Guardando…' : 'Crear Zona'}</button>
                <button type="button" onClick={onCancel} style={{ ...btnStyle, background: '#6b7280', flex: 1 }}>Cancelar</button>
            </div>
        </form>
    );
}

function SearchBar({ onSelectLocation, disabled }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef(null);
    const search = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        if (val.trim().length < 3) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try { const data = await geocodeAddress(val); setResults(data.slice(0, 5)); } catch { setResults([]); }
            setLoading(false);
        }, 500);
    };
    const pick = (item) => {
        setQuery(item.display_name.split(',').slice(0, 2).join(','));
        setResults([]);
        onSelectLocation([parseFloat(item.lat), parseFloat(item.lon)], item.display_name);
    };
    return (
        <div style={{ position: 'relative' }}>
            <input value={query} onChange={e => search(e.target.value)} placeholder="🔍 Buscar aula, lugar…" disabled={disabled} style={{ ...inputStyle, paddingLeft: 10 }} />
            {loading && <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 12 }}>⟳</span>}
            {results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 3000, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: 4 }}>
                    {results.map((r, i) => (
                        <div key={i} onMouseDown={() => pick(r)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none' }} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                            📍 {r.display_name.split(',').slice(0, 3).join(', ')}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ImportarRutasTxt({ axiosAuth, onImportSuccess, onPreviewRoutes }) {
    const fileInputRef = useRef(null);
    const [parsedRoutes, setParsedRoutes] = useState([]);
    const [parseErrors, setParseErrors] = useState([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ actual: 0, total: 0, nombre: '' });
    const [selectedPreview, setSelectedPreview] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.txt')) { alert('Solo se aceptan archivos .txt'); return; }
        setFileName(file.name); setParsedRoutes([]); setParseErrors([]); setSelectedPreview(null); onPreviewRoutes([]);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const { rutas, errors } = parseTxtRoutes(ev.target.result);
            setParsedRoutes(rutas); setParseErrors(errors);
            if (rutas.length > 0) { setSelectedPreview(0); onPreviewRoutes(rutas); }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handlePreviewSelect = (idx) => {
        setSelectedPreview(idx === selectedPreview ? null : idx);
        onPreviewRoutes(parsedRoutes, idx === selectedPreview ? null : idx);
    };

    const handleImport = async () => {
        if (parsedRoutes.length === 0) return;
        if (!window.confirm(`¿Importar ${parsedRoutes.length} ruta(s) a la base de datos?`)) return;
        setImporting(true); setImportProgress({ actual: 0, total: parsedRoutes.length, nombre: '' });
        let exitosas = 0, fallidas = 0;
        for (let i = 0; i < parsedRoutes.length; i++) {
            const ruta = parsedRoutes[i];
            setImportProgress({ actual: i + 1, total: parsedRoutes.length, nombre: ruta.nombre });
            try {
                const resRuta = await axiosAuth.post('/admin/bus/rutas', { nombre: ruta.nombre, color: ruta.color, activo: true });
                const rutaId = resRuta.data.data?._id || resRuta.data._id;
                for (let j = 0; j < ruta.stops.length; j++) {
                    const stop = ruta.stops[j];
                    await axiosAuth.post('/admin/bus/paradas', { ruta_id: rutaId, nombre: stop.nombre, latitud: stop.lat, longitud: stop.lng, orden: j });
                }
                exitosas++;
            } catch (err) { console.error(`Error importando ${ruta.nombre}:`, err.response?.data || err.message); fallidas++; }
        }
        setImporting(false); setImportProgress({ actual: 0, total: 0, nombre: '' });
        onImportSuccess(fallidas === 0 ? 'success' : 'error', fallidas === 0 ? `✅ ${exitosas} ruta(s) importadas correctamente` : `⚠️ ${exitosas} exitosas, ${fallidas} fallidas`);
        setParsedRoutes([]); setParseErrors([]); setFileName(''); setSelectedPreview(null); onPreviewRoutes([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClear = () => {
        setParsedRoutes([]); setParseErrors([]); setFileName(''); setSelectedPreview(null); onPreviewRoutes([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>📥 Importar Rutas desde Archivo</p>
            <details style={{ fontSize: 11, color: '#374151' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#1e40af' }}>ℹ️ Formato del archivo .txt</summary>
                <pre style={{ background: '#dbeafe', borderRadius: 6, padding: '8px 10px', fontSize: 10, margin: '6px 0 0', overflowX: 'auto', color: '#1e3a8a', lineHeight: 1.6 }}>{`RUTA: Ruta 1\nCOLOR: #3b82f6\nPARADA: Parada A | -0.211 | -78.491\nPARADA: Parada B | -0.215 | -78.488`}</pre>
            </details>
            <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #93c5fd', borderRadius: 8, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', background: fileName ? '#dbeafe' : '#fff' }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) { const dt = new DataTransfer(); dt.items.add(file); fileInputRef.current.files = dt.files; handleFileChange({ target: { files: [file] } }); } }}>
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileChange} style={{ display: 'none' }} />
                {fileName ? (<div><div style={{ fontSize: 20 }}>📄</div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginTop: 4 }}>{fileName}</div></div>) : (<div><div style={{ fontSize: 24 }}>📂</div><div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginTop: 4 }}>Arrastra o haz clic para subir</div></div>)}
            </div>
            {parseErrors.length > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: 6, padding: '8px 10px', border: '1px solid #fca5a5' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}>⚠️ Advertencias ({parseErrors.length})</p>
                    {parseErrors.map((e, i) => <div key={i} style={{ fontSize: 10, color: '#b91c1c', lineHeight: 1.5 }}>• {e}</div>)}
                </div>
            )}
            {parsedRoutes.length > 0 && (
                <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', margin: '0 0 4px' }}>✅ {parsedRoutes.length} ruta(s) listas</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                        {parsedRoutes.map((r, idx) => {
                            const isSelected = selectedPreview === idx;
                            return (
                                <div key={idx} onClick={() => handlePreviewSelect(idx)} style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${isSelected ? r.color : '#e5e7eb'}`, background: isSelected ? r.color + '18' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</div>
                                        <div style={{ fontSize: 10, color: '#6b7280' }}>{r.stops.length} paradas</div>
                                    </div>
                                    {isSelected && <span style={{ fontSize: 10, color: r.color, fontWeight: 700 }}>👁</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {importing && importProgress.total > 0 && (
                <div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Importando {importProgress.actual}/{importProgress.total}: {importProgress.nombre}</div>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6 }}>
                        <div style={{ background: '#3b82f6', borderRadius: 99, height: 6, width: `${(importProgress.actual / importProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleImport} disabled={importing || parsedRoutes.length === 0} style={{ ...btnStyle, background: importing || parsedRoutes.length === 0 ? '#93c5fd' : '#2563eb', flex: 1, fontSize: 12 }}>
                    {importing ? `⟳ ${importProgress.actual}/${importProgress.total}…` : parsedRoutes.length > 0 ? `📤 Importar ${parsedRoutes.length} ruta(s)` : '📤 Importar'}
                </button>
                {(parsedRoutes.length > 0 || fileName) && <button onClick={handleClear} disabled={importing} style={{ ...btnStyle, background: '#6b7280', fontSize: 12, padding: '9px 10px' }}>✕</button>}
            </div>
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const btnStyle = {
    padding: '9px 14px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
};

const MapCreate = () => {
    const { token } = storeAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const BASE_URL = useMemo(() => {
        const url = import.meta.env.VITE_BACKEND_URL || '';
        return url.endsWith('/api') ? url : `${url}/api`;
    }, []);

    const axiosAuth = useMemo(() => {
        const instance = axios.create({ baseURL: BASE_URL });
        instance.interceptors.request.use((config) => {
            const t = token || localStorage.getItem('token');
            if (t) config.headers.Authorization = `Bearer ${t}`;
            return config;
        });
        instance.interceptors.response.use((r) => r, (err) => { if (err.response?.status === 401) console.warn('Token expirado o inválido.'); return Promise.reject(err); });
        return instance;
    }, [BASE_URL, token]);

    const [activeTab, setActiveTab] = useState('pois');
    const [flyTarget, setFlyTarget] = useState({ center: [-0.21073, -78.48884], ts: 0 });
    const [zoomLevel, setZoomLevel] = useState(17);
    const [mapMode, setMapMode] = useState('view');
    const [selCategory, setSelCategory] = useState(null);
    const [pois, setPois] = useState([]);
    const [loadingPois, setLoadingPois] = useState(false);
    const [newPoiCoord, setNewPoiCoord] = useState(null);
    const [editingPoi, setEditingPoi] = useState(null);
    const [showPoiForm, setShowPoiForm] = useState(false);
    const [savingPoi, setSavingPoi] = useState(false);
    const [viewer360Url, setViewer360Url] = useState(null);
    const [routeName, setRouteName] = useState('');
    const [routeColor, setRouteColor] = useState('#3b82f6');
    const [routePoints, setRoutePoints] = useState([]);
    const [osrmLine, setOsrmLine] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const [savingRoute, setSavingRoute] = useState(false);
    const [savedRoutes, setSavedRoutes] = useState([]);
    const [selRoute, setSelRoute] = useState(null);
    const [selRouteStops, setSelRouteStops] = useState([]);
    const [editingRoute, setEditingRoute] = useState(null);
    const [deletingRoute, setDeletingRoute] = useState(null);
    const [deletingAll, setDeletingAll] = useState(false);
    const [zones, setZones] = useState([]);
    const [showZoneForm, setShowZoneForm] = useState(false);
    const [savingZone, setSavingZone] = useState(false);
    const [destination, setDestination] = useState(null);
    const [destName, setDestName] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [previewRoutes, setPreviewRoutes] = useState([]);
    const [previewRouteIdx, setPreviewRouteIdx] = useState(null);

    const showMsg = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 3000); };

    const fetchPois = useCallback(async () => {
        setLoadingPois(true);
        try {
            const url = selCategory ? `/mapa/categoria/${selCategory}` : `/mapa/ubicaciones`;
            const res = await axiosAuth.get(url);
            const raw = Array.isArray(res.data) ? res.data : res.data.data || [];
            setPois(raw.map(d => ({ _id: d._id || d.id, nombre: d.nombre || d.name || '', descripcion: d.descripcion || d.description || '', categoria: d.categoria || d.category || 'otro', latitud: d.latitud ?? d.latitude ?? 0, longitud: d.longitud ?? d.longitude ?? 0, imagen: d.imagen || null })));
        } catch { showMsg('error', 'Error al cargar ubicaciones'); }
        finally { setLoadingPois(false); }
    }, [axiosAuth, selCategory]);

    useEffect(() => { fetchPois(); }, [fetchPois]);

    const parseStops = useCallback((arr) => {
        return (Array.isArray(arr) ? arr : []).map(s => ({ nombre: s.nombre || s.name || '', lat: s.latitud ?? s.latitude ?? 0, lng: s.longitud ?? s.longitude ?? 0, orden: s.orden ?? 0 })).sort((a, b) => a.orden - b.orden);
    }, []);

    const fetchRoutes = useCallback(async () => {
        try {
            const res = await axiosAuth.get('/bus/rutas');
            const rutas = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
            const rutasConParadas = await Promise.all(rutas.map(async (r) => {
                const id = r._id || r.id;
                try {
                    const pr = await axiosAuth.get(`/bus/paradas/${id}`);
                    const arr = Array.isArray(pr.data) ? pr.data : Array.isArray(pr.data?.data) ? pr.data.data : [];
                    return { ...r, _stops: parseStops(arr) };
                } catch { return { ...r, _stops: [] }; }
            }));
            setSavedRoutes(rutasConParadas);
        } catch {}
    }, [axiosAuth, parseStops]);

    useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

    const fetchZones = useCallback(async () => {
        try {
            const res = await axiosAuth.get('/admin/mapa/zonas');
            const raw = Array.isArray(res.data) ? res.data : res.data.data || [];
            setZones(raw.map(z => ({ _id: z._id || z.id, nombre: z.nombre || z.name || '', coordinates: z.coordenadas || z.coordinates || [], fillColor: z.fill_color || z.fillColor || 'rgba(239,68,68,0.2)', strokeColor: z.stroke_color || z.strokeColor || '#ef4444', isActive: z.activo ?? z.isActive ?? true })));
        } catch {}
    }, [axiosAuth]);

    useEffect(() => { fetchZones(); }, [fetchZones]);

    const clusteredPois = clusterPois(pois, zoomLevel);

    const handleAddStop = useCallback((coords) => { setRoutePoints(prev => [...prev, coords]); }, []);
    const handleSetDestination = useCallback((coords) => { setDestination(coords); setDestName(''); setMapMode('view'); }, []);
    const handleAddPoiCoord = useCallback((coord) => { setNewPoiCoord(coord); setEditingPoi(null); setShowPoiForm(true); setMapMode('addPoi'); }, []);

    useEffect(() => {
        if (routePoints.length < 2) { setOsrmLine([]); setRouteInfo(null); return; }
        const last = routePoints[routePoints.length - 1];
        const prev = routePoints[routePoints.length - 2];
        getOsrmRoute({ lat: prev[0], lng: prev[1] }, { lat: last[0], lng: last[1] })
            .then(r => { setOsrmLine(old => [...old, ...r.waypoints]); setRouteInfo(r); })
            .catch(() => { setOsrmLine(old => [...old, prev, last]); });
    }, [routePoints]);

    const handleSavePoi = async (poiData) => {
        setSavingPoi(true);
        try {
            if (editingPoi) {
                await axiosAuth.put(`/admin/mapa/ubicaciones/${editingPoi._id}`, { nombre: poiData.nombre, descripcion: poiData.descripcion, categoria: poiData.categoria, imagen: poiData.imagen });
                showMsg('success', 'Ubicación actualizada');
            } else {
                await axiosAuth.post('/admin/mapa/ubicaciones', { nombre: poiData.nombre, descripcion: poiData.descripcion, categoria: poiData.categoria, latitud: poiData.latitud, longitud: poiData.longitud, imagen: poiData.imagen });
                showMsg('success', 'Ubicación creada');
            }
            setShowPoiForm(false); setNewPoiCoord(null); setEditingPoi(null); setMapMode('view'); fetchPois();
        } catch (err) {
            showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : err.response?.data?.message || 'Error al guardar');
        } finally { setSavingPoi(false); }
    };

    const handleDeletePoi = async (poi) => {
        if (!window.confirm(`¿Eliminar "${poi.nombre}"?`)) return;
        try {
            await axiosAuth.delete(`/admin/mapa/ubicaciones/${poi._id}`);
            showMsg('success', 'Ubicación eliminada'); fetchPois();
        } catch (err) { showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : 'Error al eliminar'); }
    };

    const handleSaveRoute = async () => {
        if (!routeName.trim() || routePoints.length < 2) return showMsg('error', 'Completa el nombre y al menos 2 paradas');
        setSavingRoute(true);
        try {
            const resRuta = await axiosAuth.post('/admin/bus/rutas', { nombre: routeName, color: routeColor, activo: true });
            const rutaId = resRuta.data.data?._id || resRuta.data._id;
            for (let i = 0; i < routePoints.length; i++) {
                await axiosAuth.post('/admin/bus/paradas', { ruta_id: rutaId, nombre: `Parada ${i + 1}`, latitud: routePoints[i][0], longitud: routePoints[i][1], orden: i });
            }
            showMsg('success', 'Ruta guardada');
            setRouteName(''); setRoutePoints([]); setOsrmLine([]); setRouteInfo(null); fetchRoutes();
        } catch (err) { showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : err.response?.data?.message || 'Error al guardar ruta'); }
        finally { setSavingRoute(false); }
    };

    const handleSaveZone = async (zoneData) => {
        setSavingZone(true);
        try {
            await axiosAuth.post('/admin/mapa/zonas', { nombre: zoneData.nombre, coordenadas: zoneData.coordinates, fill_color: zoneData.fill_color, stroke_color: zoneData.stroke_color, activo: true });
            showMsg('success', 'Zona creada'); setShowZoneForm(false); fetchZones();
        } catch (err) { showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : err.response?.data?.message || 'Error al guardar zona'); }
        finally { setSavingZone(false); }
    };

    const handleSelectRoute = useCallback((r) => {
        const id = r._id || r.id;
        if (selRoute && (selRoute._id || selRoute.id) === id) { setSelRoute(null); setSelRouteStops([]); return; }
        setSelRoute(r);
        const stops = r._stops || [];
        setSelRouteStops(stops);
        if (stops.length > 0) setFlyTarget({ center: [stops[0].lat, stops[0].lng], ts: Date.now() });
        else showMsg('error', 'Esta ruta no tiene paradas registradas');
    }, [selRoute]);

    const handleDeleteRoute = async (r, e) => {
        e.stopPropagation();
        const id = r._id || r.id;
        const stops = r._stops || [];
        if (!window.confirm(`¿Eliminar la ruta "${r.nombre || r.name}"${stops.length > 0 ? ` y sus ${stops.length} parada(s)` : ''}?`)) return;
        setDeletingRoute(id);
        try {
            await Promise.allSettled(stops.map(s => { const sid = s._id || s.id; return sid ? axiosAuth.delete(`/admin/bus/paradas/${sid}`) : Promise.resolve(); }));
            await axiosAuth.delete(`/admin/bus/rutas/${id}`);
            showMsg('success', `Ruta eliminada`);
            if ((selRoute?._id || selRoute?.id) === id) { setSelRoute(null); setSelRouteStops([]); }
            fetchRoutes();
        } catch (err) { showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : 'Error al eliminar la ruta'); }
        finally { setDeletingRoute(null); }
    };

    const handleDeleteAllRoutes = async () => {
        if (savedRoutes.length === 0) return;
        const totalStops = savedRoutes.reduce((acc, r) => acc + (r._stops?.length || 0), 0);
        if (!window.confirm(`¿Eliminar las ${savedRoutes.length} rutas${totalStops > 0 ? ` y sus ${totalStops} parada(s)` : ''}? Esta acción no se puede deshacer.`)) return;
        setDeletingAll(true);
        let ok = 0, fail = 0;
        for (const r of savedRoutes) {
            try {
                const stops = r._stops || [];
                await Promise.allSettled(stops.map(s => { const sid = s._id || s.id; return sid ? axiosAuth.delete(`/admin/bus/paradas/${sid}`) : Promise.resolve(); }));
                await axiosAuth.delete(`/admin/bus/rutas/${r._id || r.id}`);
                ok++;
            } catch { fail++; }
        }
        setSelRoute(null); setSelRouteStops([]); setDeletingAll(false);
        showMsg(fail === 0 ? 'success' : 'error', fail === 0 ? `✅ ${ok} ruta(s) eliminadas` : `⚠️ ${ok} eliminadas, ${fail} fallidas`);
        fetchRoutes();
    };

    const handleUpdateRoute = async () => {
        if (!editingRoute) return;
        try {
            await axiosAuth.put(`/admin/bus/rutas/${editingRoute._id}`, { nombre: editingRoute.nombre, color: editingRoute.color });
            showMsg('success', 'Ruta actualizada');
            setEditingRoute(null);
            if (selRoute && (selRoute._id || selRoute.id) === editingRoute._id) setSelRoute(prev => ({ ...prev, nombre: editingRoute.nombre, color: editingRoute.color }));
            fetchRoutes();
        } catch (err) { showMsg('error', err.response?.status === 401 ? 'Sesión expirada' : 'Error al actualizar la ruta'); }
    };

    const handlePreviewRoutes = useCallback((rutas, selectedIdx = null) => {
        setPreviewRoutes(rutas);
        setPreviewRouteIdx(selectedIdx !== undefined ? selectedIdx : null);
        if (selectedIdx !== null && rutas[selectedIdx]?.stops.length > 0) {
            const firstStop = rutas[selectedIdx].stops[0];
            setFlyTarget({ center: [firstStop.lat, firstStop.lng], ts: Date.now() });
        }
    }, []);

    const activePreviewRoute = previewRouteIdx !== null ? previewRoutes[previewRouteIdx] : null;

    const sidebarWidth = isMobile ? '100%' : 290;

    const sidebarContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
            <SearchBar onSelectLocation={(coords, name) => { setFlyTarget({ center: coords, ts: Date.now() }); setDestination(coords); setDestName(name); if (isMobile) setSidebarOpen(false); }} disabled={false} />

            {activeTab === 'pois' && (
                <>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Categoría</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            <button onClick={() => setSelCategory(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1.5px solid ' + (!selCategory ? '#1d4ed8' : '#e5e7eb'), background: !selCategory ? '#1d4ed8' : '#fff', color: !selCategory ? '#fff' : '#374151', cursor: 'pointer' }}>Todos</button>
                            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                                <button key={key} onClick={() => setSelCategory(selCategory === key ? null : key)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${selCategory === key ? cfg.color : '#e5e7eb'}`, background: selCategory === key ? cfg.color : '#fff', color: selCategory === key ? '#fff' : '#374151', cursor: 'pointer' }}>{cfg.label}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => { if (mapMode === 'addPoi' && showPoiForm) { setMapMode('view'); setShowPoiForm(false); setNewPoiCoord(null); setEditingPoi(null); } else { setMapMode('addPoi'); setNewPoiCoord(null); setEditingPoi(null); setShowPoiForm(true); } }} style={{ ...btnStyle, background: mapMode === 'addPoi' ? '#fef3c7' : '#1d4ed8', color: mapMode === 'addPoi' ? '#92400e' : '#fff', border: mapMode === 'addPoi' ? '2px solid #f59e0b' : 'none' }}>
                        {mapMode === 'addPoi' ? '👆 Toca el mapa para añadir…' : '+ Nueva Ubicación'}
                    </button>
                    {showPoiForm && (
                        <div style={{ background: '#f8faff', borderRadius: 8, padding: 12, border: '1.5px solid #bfdbfe' }}>
                            <PoiForm coord={newPoiCoord} editingPoi={editingPoi} isLoading={savingPoi} onSubmit={handleSavePoi} onCancel={() => { setShowPoiForm(false); setNewPoiCoord(null); setEditingPoi(null); setMapMode('view'); }} onCoordChange={(coord) => setNewPoiCoord(coord)} />
                        </div>
                    )}
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ubicaciones ({pois.length}){loadingPois && ' ⟳'}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {pois.map(poi => {
                                const cfg = CATEGORY_CONFIG[poi.categoria] || CATEGORY_CONFIG.otro;
                                return (
                                    <div key={poi._id} onClick={() => { setFlyTarget({ center: [poi.latitud, poi.longitud], ts: Date.now() }); if (isMobile) setSidebarOpen(false); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.nombre}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, background: cfg.color + '20', color: cfg.color, padding: '1px 6px', borderRadius: 6 }}>{cfg.label}</span>
                                                {poi.imagen && <span style={{ fontSize: 10, fontWeight: 700, background: '#f0f9ff', color: '#0369a1', padding: '1px 5px', borderRadius: 6, border: '1px solid #bae6fd' }}>🔭 360°</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
                                            <button onClick={e => { e.stopPropagation(); setEditingPoi(poi); setNewPoiCoord(null); setShowPoiForm(true); }} style={{ ...btnStyle, padding: '3px 7px', background: '#3b82f6', fontSize: 11 }}>✏️</button>
                                            <button onClick={e => { e.stopPropagation(); handleDeletePoi(poi); }} style={{ ...btnStyle, padding: '3px 7px', background: '#ef4444', fontSize: 11 }}>🗑️</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'rutas' && (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <input value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Nombre de la ruta" style={inputStyle} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>Color:</label>
                            <input type="color" value={routeColor} onChange={e => setRouteColor(e.target.value)} style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }} />
                        </div>
                    </div>
                    <button onClick={() => setMapMode(mapMode === 'addStop' ? 'view' : 'addStop')} style={{ ...btnStyle, background: mapMode === 'addStop' ? '#fef3c7' : '#059669', color: mapMode === 'addStop' ? '#92400e' : '#fff', border: mapMode === 'addStop' ? '2px solid #f59e0b' : 'none' }}>
                        {mapMode === 'addStop' ? '👆 Toca el mapa para añadir parada…' : '+ Agregar Parada'}
                    </button>
                    {routePoints.length > 0 && (
                        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 10, border: '1px solid #86efac' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', margin: '0 0 6px' }}>{routePoints.length} parada(s) agregada(s)</p>
                            {routeInfo && <p style={{ fontSize: 12, color: '#15803d', margin: '0 0 6px' }}>📏 {(routeInfo.distance / 1000).toFixed(2)} km · ⏱ {Math.ceil(routeInfo.duration / 60)} min</p>}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={handleSaveRoute} disabled={savingRoute} style={{ ...btnStyle, background: '#16a34a', flex: 1 }}>{savingRoute ? '⟳ Guardando…' : '💾 Guardar Ruta'}</button>
                                <button onClick={() => { setRoutePoints([]); setOsrmLine([]); setRouteInfo(null); }} style={{ ...btnStyle, background: '#ef4444' }}>🗑️</button>
                            </div>
                        </div>
                    )}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Rutas guardadas ({savedRoutes.length})</p>
                            {savedRoutes.length > 0 && <button onClick={handleDeleteAllRoutes} disabled={deletingAll} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11, background: deletingAll ? '#fca5a5' : '#ef4444' }}>{deletingAll ? '⟳' : '🗑️ Todas'}</button>}
                        </div>
                        {editingRoute && (
                            <div style={{ background: '#eff6ff', borderRadius: 8, padding: 10, border: '1.5px solid #93c5fd', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e40af' }}>✏️ Editar ruta</p>
                                <input value={editingRoute.nombre} onChange={e => setEditingRoute(prev => ({ ...prev, nombre: e.target.value }))} style={{ ...inputStyle, fontSize: 12 }} placeholder="Nombre de la ruta" />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600 }}>Color:</label>
                                    <input type="color" value={editingRoute.color} onChange={e => setEditingRoute(prev => ({ ...prev, color: e.target.value }))} style={{ width: 36, height: 28, border: 'none', cursor: 'pointer' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={handleUpdateRoute} style={{ ...btnStyle, background: '#1d4ed8', flex: 1, fontSize: 12 }}>💾 Guardar</button>
                                    <button onClick={() => setEditingRoute(null)} style={{ ...btnStyle, background: '#6b7280', fontSize: 12 }}>✕</button>
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {savedRoutes.map(r => {
                                const rid = r._id || r.id;
                                const isActive = (selRoute?._id || selRoute?.id) === rid;
                                const isDeleting = deletingRoute === rid;
                                return (
                                    <div key={rid} style={{ borderRadius: 8, border: `1.5px solid ${isActive ? r.color : '#e5e7eb'}`, background: isActive ? r.color + '18' : '#fff', overflow: 'hidden' }}>
                                        <div onClick={() => handleSelectRoute(r)} style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre || r.name}</span>
                                            {isActive && <span style={{ fontSize: 10, color: r.color, fontWeight: 700, flexShrink: 0 }}>👁</span>}
                                            <button onClick={e => { e.stopPropagation(); setEditingRoute({ _id: rid, nombre: r.nombre || r.name, color: r.color || '#3b82f6' }); }} style={{ ...btnStyle, padding: '3px 7px', background: '#3b82f6', fontSize: 10, flexShrink: 0 }}>✏️</button>
                                            <button onClick={e => handleDeleteRoute(r, e)} disabled={isDeleting} style={{ ...btnStyle, padding: '3px 7px', background: isDeleting ? '#fca5a5' : '#ef4444', fontSize: 10, flexShrink: 0 }}>{isDeleting ? '⟳' : '🗑️'}</button>
                                        </div>
                                        {isActive && selRouteStops.length > 0 && (
                                            <div style={{ borderTop: `1px solid ${r.color}40`, padding: '6px 10px 8px', maxHeight: 140, overflowY: 'auto', background: '#f8faff' }}>
                                                {selRouteStops.map((s, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: i === 0 ? '#16a34a' : i === selRouteStops.length - 1 ? '#dc2626' : r.color }} />
                                                        <span style={{ fontSize: 11, color: '#374151' }}>{s.nombre}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {isActive && selRouteStops.length === 0 && <div style={{ padding: '4px 10px 8px', fontSize: 11, color: '#9ca3af' }}>⚠️ Sin paradas registradas</div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <ImportarRutasTxt axiosAuth={axiosAuth} onImportSuccess={(type, text) => { showMsg(type, text); fetchRoutes(); }} onPreviewRoutes={(rutas, idx) => handlePreviewRoutes(rutas, idx)} />
                </>
            )}

            {activeTab === 'zonas' && (
                <>
                    <button onClick={() => setShowZoneForm(!showZoneForm)} style={{ ...btnStyle, background: '#dc2626' }}>{showZoneForm ? 'Cancelar' : '+ Nueva Zona'}</button>
                    {showZoneForm && (
                        <div style={{ background: '#fff5f5', borderRadius: 8, padding: 12, border: '1.5px solid #fca5a5' }}>
                            <ZoneForm isLoading={savingZone} onSave={handleSaveZone} onCancel={() => setShowZoneForm(false)} />
                        </div>
                    )}
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Zonas ({zones.length})</p>
                        {zones.map(z => (
                            <div key={z._id} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: z.strokeColor }} />
                                <span style={{ fontSize: 13, color: '#111827' }}>{z.nombre}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', fontFamily: 'system-ui,sans-serif' }}>
            {viewer360Url && <Viewer360 imageUrl={viewer360Url} onClose={() => setViewer360Url(null)} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f8faff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                {isMobile && (
                    <button onClick={() => setSidebarOpen(v => !v)} style={{ ...btnStyle, background: sidebarOpen ? '#1d4ed8' : '#fff', color: sidebarOpen ? '#fff' : '#374151', border: '1px solid #e5e7eb', padding: '7px 12px', fontSize: 18 }}>
                        {sidebarOpen ? '✕' : '☰'}
                    </button>
                )}
                {[{ key: 'pois', label: '📍 Ubicaciones' }, { key: 'rutas', label: '🚌 Rutas' }, { key: 'zonas', label: '⚠️ Zonas' }].map(tab => (
                    <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMapMode('view'); if (isMobile) setSidebarOpen(true); }} style={{ padding: isMobile ? '6px 10px' : '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: isMobile ? 12 : 13, fontWeight: 600, background: activeTab === tab.key ? '#1d4ed8' : '#fff', color: activeTab === tab.key ? '#fff' : '#374151', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>{tab.label}</button>
                ))}
            </div>

            {message.text && (
                <div style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#dc2626' : '#16a34a', borderBottom: `2px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}` }}>
                    {message.type === 'error' ? '❌' : '✅'} {message.text}
                </div>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                {isMobile ? (
                    <>
                        {sidebarOpen && (
                            <>
                                <div onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 900 }} />
                                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '85%', maxWidth: 340, background: '#fff', zIndex: 1000, overflowY: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', background: '#f8faff' }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1e40af' }}>Panel de Control</span>
                                        <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                                    </div>
                                    {sidebarContent}
                                </div>
                            </>
                        )}
                        <div style={{ flex: 1, position: 'relative' }}>
                            {mapMode !== 'view' && (
                                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: '#fef3c7', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#92400e', boxShadow: '0 4px 12px rgba(0,0,0,.15)', border: '1.5px solid #f59e0b', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                                    {mapMode === 'addPoi' && '📍 Toca el mapa para colocar la ubicación'}
                                    {mapMode === 'addStop' && '🚌 Toca el mapa para agregar una parada'}
                                    {mapMode === 'setDest' && '🏁 Toca el mapa para fijar el destino'}
                                </div>
                            )}
                            <MapContainer center={flyTarget.center} zoom={zoomLevel} maxZoom={22} style={{ height: '100%', width: '100%', zIndex: 0 }} whenReady={({ target: map }) => { map.on('zoomend', () => setZoomLevel(map.getZoom())); }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' maxZoom={22} maxNativeZoom={19} />
                                <FlyTo center={flyTarget.center} zoom={17} ts={flyTarget.ts} />
                                <MapClickHandler mode={mapMode} onAddStop={handleAddStop} onSetDestination={handleSetDestination} onAddPoiCoord={handleAddPoiCoord} />
                                {newPoiCoord && <Marker position={[newPoiCoord.lat, newPoiCoord.lng]} icon={newPoiIcon}><Popup>Nueva ubicación</Popup></Marker>}
                                {clusteredPois.map((item, idx) => item._isCluster ? (
                                    <CircleMarker key={`cluster-${idx}`} center={[item.latitud, item.longitud]} radius={Math.min(22, 12 + item._count * 1.5)} pathOptions={{ color: CATEGORY_CONFIG[item._topCategory]?.color || '#6b7280', fillColor: CATEGORY_CONFIG[item._topCategory]?.color || '#6b7280', fillOpacity: 0.85, weight: 2.5 }}>
                                        <Popup><strong>{item._count} lugares</strong><br />{item._items.map(p => <div key={p._id} style={{ fontSize: 12 }}>{p.nombre}</div>)}</Popup>
                                    </CircleMarker>
                                ) : (
                                    <Marker key={item._id} position={[item.latitud, item.longitud]} icon={createPoiIcon(item.categoria)}>
                                        <Popup minWidth={200}>
                                            <div style={{ minWidth: 180 }}>
                                                <strong style={{ fontSize: 14 }}>{item.nombre}</strong>
                                                {item.descripcion && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0' }}>{item.descripcion}</p>}
                                                <span style={{ fontSize: 10, fontWeight: 700, background: (CATEGORY_CONFIG[item.categoria]?.color || '#9ca3af') + '20', color: CATEGORY_CONFIG[item.categoria]?.color || '#9ca3af', padding: '2px 8px', borderRadius: 6 }}>{CATEGORY_CONFIG[item.categoria]?.label || 'Otro'}</span>
                                                {item.imagen && (
                                                    <div style={{ marginTop: 10 }}>
                                                        <div style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '2px solid #bae6fd' }} onClick={() => setViewer360Url(item.imagen)}>
                                                            <img src={item.imagen} alt="Vista 360°" style={{ width: '100%', height: 70, objectFit: 'cover', display: 'block' }} onError={e => { e.target.closest('div').style.display = 'none'; }} />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,105,161,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                                                <span style={{ fontSize: 20 }}>🔭</span>
                                                                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>Ver en 360°</span>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setViewer360Url(item.imagen)} style={{ marginTop: 6, width: '100%', padding: '6px', borderRadius: 7, background: '#0369a1', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔭 Abrir vista 360°</button>
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                                {routePoints.map((p, i) => (
                                    <CircleMarker key={`stop-${i}`} center={p} radius={9} pathOptions={{ color: i === 0 ? '#16a34a' : i === routePoints.length - 1 ? '#dc2626' : routeColor, fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                        <Popup>{i === 0 ? '🟢 Inicio' : i === routePoints.length - 1 ? '🔴 Fin' : `Parada ${i + 1}`}</Popup>
                                    </CircleMarker>
                                ))}
                                {osrmLine.length > 1 && <Polyline positions={osrmLine} pathOptions={{ color: routeColor, weight: 5, opacity: 0.85 }} />}
                                {selRoute && selRouteStops.length > 1 && (
                                    <>
                                        <Polyline positions={selRouteStops.map(s => [s.lat, s.lng])} pathOptions={{ color: selRoute.color || '#3b82f6', weight: 5, opacity: 0.9 }} />
                                        {selRouteStops.map((stop, i) => (
                                            <CircleMarker key={`sel-stop-${i}`} center={[stop.lat, stop.lng]} radius={i === 0 || i === selRouteStops.length - 1 ? 11 : 7} pathOptions={{ color: i === 0 ? '#16a34a' : i === selRouteStops.length - 1 ? '#dc2626' : selRoute.color || '#3b82f6', fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                                <Popup><strong>{i === 0 ? '🟢 ' : i === selRouteStops.length - 1 ? '🔴 ' : `${i + 1}. `}{stop.nombre}</strong></Popup>
                                            </CircleMarker>
                                        ))}
                                    </>
                                )}
                                {activePreviewRoute && (
                                    <>
                                        <Polyline positions={activePreviewRoute.stops.map(s => [s.lat, s.lng])} pathOptions={{ color: activePreviewRoute.color, weight: 4, opacity: 0.75, dashArray: '8 6' }} />
                                        {activePreviewRoute.stops.map((stop, i) => (
                                            <CircleMarker key={`preview-stop-${i}`} center={[stop.lat, stop.lng]} radius={i === 0 || i === activePreviewRoute.stops.length - 1 ? 10 : 7} pathOptions={{ color: i === 0 ? '#16a34a' : i === activePreviewRoute.stops.length - 1 ? '#dc2626' : activePreviewRoute.color, fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                                <Popup><strong>{i === 0 ? '🟢 ' : i === activePreviewRoute.stops.length - 1 ? '🔴 ' : `${i + 1}. `}{stop.nombre}</strong></Popup>
                                            </CircleMarker>
                                        ))}
                                    </>
                                )}
                                {zones.filter(z => z.isActive).map(zone => (
                                    <Polygon key={zone._id} positions={zone.coordinates.map(c => [c.lat ?? c.latitude, c.lng ?? c.longitude])} pathOptions={{ fillColor: zone.fillColor, color: zone.strokeColor, weight: 2, fillOpacity: 0.4 }}>
                                        <Popup><strong>{zone.nombre}</strong></Popup>
                                    </Polygon>
                                ))}
                                {destination && <CircleMarker center={destination} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#fca5a5', fillOpacity: 0.9, weight: 2.5 }}><Popup>🏁 {destName || 'Destino'}</Popup></CircleMarker>}
                            </MapContainer>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ width: sidebarWidth, overflowY: 'auto', background: '#fff', borderRight: '1px solid #e5e7eb', height: '100%', flexShrink: 0 }}>
                            {sidebarContent}
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            {mapMode !== 'view' && (
                                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fef3c7', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#92400e', boxShadow: '0 4px 12px rgba(0,0,0,.15)', border: '1.5px solid #f59e0b', pointerEvents: 'none' }}>
                                    {mapMode === 'addPoi' && '📍 Toca el mapa para colocar la nueva ubicación'}
                                    {mapMode === 'addStop' && '🚌 Toca el mapa para agregar una parada'}
                                    {mapMode === 'setDest' && '🏁 Toca el mapa para fijar el destino'}
                                </div>
                            )}
                            {selRoute && selRouteStops.length > 0 && !activePreviewRoute && (
                                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#111827', boxShadow: '0 4px 12px rgba(0,0,0,.2)', border: `2px solid ${selRoute.color || '#3b82f6'}`, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: selRoute.color || '#3b82f6' }} />
                                    🚌 {selRoute.nombre || selRoute.name} · {selRouteStops.length} paradas
                                </div>
                            )}
                            {activePreviewRoute && (
                                <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#111827', boxShadow: '0 4px 12px rgba(0,0,0,.2)', border: `2px solid ${activePreviewRoute.color}`, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: activePreviewRoute.color }} />
                                    Vista previa: {activePreviewRoute.nombre} ({activePreviewRoute.stops.length} paradas)
                                </div>
                            )}
                            <MapContainer center={flyTarget.center} zoom={zoomLevel} maxZoom={22} style={{ height: '100%', width: '100%', zIndex: 0 }} whenReady={({ target: map }) => { map.on('zoomend', () => setZoomLevel(map.getZoom())); }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' maxZoom={22} maxNativeZoom={19} />
                                <FlyTo center={flyTarget.center} zoom={17} ts={flyTarget.ts} />
                                <MapClickHandler mode={mapMode} onAddStop={handleAddStop} onSetDestination={handleSetDestination} onAddPoiCoord={handleAddPoiCoord} />
                                {newPoiCoord && <Marker position={[newPoiCoord.lat, newPoiCoord.lng]} icon={newPoiIcon}><Popup>Nueva ubicación</Popup></Marker>}
                                {clusteredPois.map((item, idx) => item._isCluster ? (
                                    <CircleMarker key={`cluster-${idx}`} center={[item.latitud, item.longitud]} radius={Math.min(22, 12 + item._count * 1.5)} pathOptions={{ color: CATEGORY_CONFIG[item._topCategory]?.color || '#6b7280', fillColor: CATEGORY_CONFIG[item._topCategory]?.color || '#6b7280', fillOpacity: 0.85, weight: 2.5 }}>
                                        <Popup><strong>{item._count} lugares</strong><br />{item._items.map(p => <div key={p._id} style={{ fontSize: 12 }}>{p.nombre}</div>)}</Popup>
                                    </CircleMarker>
                                ) : (
                                    <Marker key={item._id} position={[item.latitud, item.longitud]} icon={createPoiIcon(item.categoria)}>
                                        <Popup minWidth={220}>
                                            <div style={{ minWidth: 200 }}>
                                                <strong style={{ fontSize: 14 }}>{item.nombre}</strong>
                                                {item.descripcion && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0' }}>{item.descripcion}</p>}
                                                <span style={{ fontSize: 10, fontWeight: 700, background: (CATEGORY_CONFIG[item.categoria]?.color || '#9ca3af') + '20', color: CATEGORY_CONFIG[item.categoria]?.color || '#9ca3af', padding: '2px 8px', borderRadius: 6 }}>{CATEGORY_CONFIG[item.categoria]?.label || 'Otro'}</span>
                                                {item.imagen && (
                                                    <div style={{ marginTop: 10 }}>
                                                        <div style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '2px solid #bae6fd' }} onClick={() => setViewer360Url(item.imagen)}>
                                                            <img src={item.imagen} alt="Vista 360°" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} onError={e => { e.target.closest('div').style.display = 'none'; }} />
                                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,105,161,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                                                <span style={{ fontSize: 22 }}>🔭</span>
                                                                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>Ver en 360°</span>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setViewer360Url(item.imagen)} style={{ marginTop: 6, width: '100%', padding: '6px', borderRadius: 7, background: '#0369a1', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔭 Abrir vista 360°</button>
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                                {routePoints.map((p, i) => (
                                    <CircleMarker key={`stop-${i}`} center={p} radius={9} pathOptions={{ color: i === 0 ? '#16a34a' : i === routePoints.length - 1 ? '#dc2626' : routeColor, fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                        <Popup>{i === 0 ? '🟢 Inicio' : i === routePoints.length - 1 ? '🔴 Fin' : `Parada ${i + 1}`}</Popup>
                                    </CircleMarker>
                                ))}
                                {osrmLine.length > 1 && <Polyline positions={osrmLine} pathOptions={{ color: routeColor, weight: 5, opacity: 0.85 }} />}
                                {selRoute && selRouteStops.length > 1 && (
                                    <>
                                        <Polyline positions={selRouteStops.map(s => [s.lat, s.lng])} pathOptions={{ color: selRoute.color || '#3b82f6', weight: 5, opacity: 0.9 }} />
                                        {selRouteStops.map((stop, i) => (
                                            <CircleMarker key={`sel-stop-${i}`} center={[stop.lat, stop.lng]} radius={i === 0 || i === selRouteStops.length - 1 ? 11 : 7} pathOptions={{ color: i === 0 ? '#16a34a' : i === selRouteStops.length - 1 ? '#dc2626' : selRoute.color || '#3b82f6', fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                                <Popup>
                                                    <strong style={{ fontSize: 13 }}>{i === 0 ? '🟢 ' : i === selRouteStops.length - 1 ? '🔴 ' : `${i + 1}. `}{stop.nombre}</strong>
                                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</div>
                                                </Popup>
                                            </CircleMarker>
                                        ))}
                                    </>
                                )}
                                {activePreviewRoute && (
                                    <>
                                        <Polyline positions={activePreviewRoute.stops.map(s => [s.lat, s.lng])} pathOptions={{ color: activePreviewRoute.color, weight: 4, opacity: 0.75, dashArray: '8 6' }} />
                                        {activePreviewRoute.stops.map((stop, i) => (
                                            <CircleMarker key={`preview-stop-${i}`} center={[stop.lat, stop.lng]} radius={i === 0 || i === activePreviewRoute.stops.length - 1 ? 10 : 7} pathOptions={{ color: i === 0 ? '#16a34a' : i === activePreviewRoute.stops.length - 1 ? '#dc2626' : activePreviewRoute.color, fillColor: '#fff', fillOpacity: 1, weight: 2.5 }}>
                                                <Popup>
                                                    <strong style={{ fontSize: 13 }}>{i === 0 ? '🟢 ' : i === activePreviewRoute.stops.length - 1 ? '🔴 ' : `${i + 1}. `}{stop.nombre}</strong>
                                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</div>
                                                </Popup>
                                            </CircleMarker>
                                        ))}
                                    </>
                                )}
                                {zones.filter(z => z.isActive).map(zone => (
                                    <Polygon key={zone._id} positions={zone.coordinates.map(c => [c.lat ?? c.latitude, c.lng ?? c.longitude])} pathOptions={{ fillColor: zone.fillColor, color: zone.strokeColor, weight: 2, fillOpacity: 0.4 }}>
                                        <Popup><strong>{zone.nombre}</strong></Popup>
                                    </Polygon>
                                ))}
                                {destination && <CircleMarker center={destination} radius={10} pathOptions={{ color: '#dc2626', fillColor: '#fca5a5', fillOpacity: 0.9, weight: 2.5 }}><Popup>🏁 {destName || 'Destino'}</Popup></CircleMarker>}
                            </MapContainer>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MapCreate;
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import storeAuth from '../../context/storeAuth';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userLocationIcon = L.divIcon({
    className: '',
    html: `<div style="position:relative;width:24px;height:24px">
        <div style="position:absolute;inset:0;background:#2563eb;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,.3);animation:pulseBlue 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:4px;background:#fff;border-radius:50%;"></div>
        <div style="position:absolute;inset:7px;background:#2563eb;border-radius:50%;"></div>
    </div>
    <style>@keyframes pulseBlue{0%,100%{box-shadow:0 0 0 4px rgba(37,99,235,.3)}50%{box-shadow:0 0 0 10px rgba(37,99,235,.1)}}</style>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
});

const destinationIcon = L.divIcon({
    className: '',
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));">
        <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.234 22.75 15.265 23.648a1 1 0 001.47 0C17.766 38.75 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#ef4444"/>
            <circle cx="16" cy="16" r="7" fill="#fff"/>
            <circle cx="16" cy="16" r="4" fill="#ef4444"/>
        </svg>
    </div>`,
    iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -42],
});

function parseTxtToRutasData(text) {
    const rutasData = {};
    let current = null;
    let idx = 0;

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith('RUTA:')) {
            if (current) rutasData[`ruta${idx}`] = current;
            idx++;
            current = { name: line.replace('RUTA:', '').trim(), color: '#3b82f6', stops: [] };
        } else if (line.startsWith('COLOR:') && current) {
            current.color = line.replace('COLOR:', '').trim();
        } else if (line.startsWith('PARADA:') && current) {
            const parts = line.replace('PARADA:', '').split('|').map(p => p.trim());
            if (parts.length >= 3) {
                const lat = parseFloat(parts[1]);
                const lng = parseFloat(parts[2]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    current.stops.push({
                        id: current.stops.length + 1,
                        name: parts[0],
                        position: [lat, lng],
                    });
                }
            }
        }
    }
    if (current) rutasData[`ruta${idx}`] = current;
    return rutasData;
}

async function geocodeAddress(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ec`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    return res.json();
}

async function getOsrmRoute(origin, destination) {
    const url = `https://router.project-osrm.org/route/v1/walking/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM error');
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) throw new Error('Sin ruta');
    return {
        waypoints: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: (route.distance / 1000).toFixed(2),
        duration: Math.ceil(route.duration / 60),
    };
}

function MapUpdater({ center, zoom }) {
    const map = useMap();
    useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.2 }); }, [center, zoom, map]);
    return null;
}

function MapClickHandler({ mode, onAddStop, onSetDestination }) {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            if (mode === 'addStop') onAddStop([lat, lng]);
            else if (mode === 'setDest') onSetDestination([lat, lng]);
        },
    });
    return null;
}

function RoutePolyline({ stops, color }) {
    const [lines, setLines] = useState([]);

    useEffect(() => {
        if (stops.length < 2) { setLines([]); return; }
        let cancelled = false;
        (async () => {
            const segments = [];
            for (let i = 0; i < stops.length - 1; i++) {
                try {
                    const r = await getOsrmRoute(stops[i].position, stops[i + 1].position);
                    if (!cancelled) segments.push(...r.waypoints);
                } catch {
                    if (!cancelled) segments.push(stops[i].position, stops[i + 1].position);
                }
            }
            if (!cancelled) setLines(segments);
        })();
        return () => { cancelled = true; };
    }, [stops]);

    if (lines.length < 2) return null;
    return <Polyline positions={lines} pathOptions={{ color: color || '#3b82f6', weight: 4, opacity: 0.8 }} />;
}

function ETABanner({ routeInfo, onClose, destination, destName }) {
    if (!routeInfo) return null;
    const h = Math.floor(routeInfo.duration / 60);
    const m = routeInfo.duration % 60;
    const eta = new Date(Date.now() + routeInfo.duration * 60000);
    const etaStr = eta.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return (
        <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, background: '#fff', borderRadius: 14,
            boxShadow: '0 4px 24px rgba(0,0,0,.18)',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14,
            minWidth: 300, maxWidth: '90%', border: '1.5px solid #e5e7eb',
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📍 {destName || (destination ? `${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}` : '—')}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                    {h > 0 ? `${h}h ` : ''}{m} min · {routeInfo.distance} km
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Llegada estimada: <strong style={{ color: '#2563eb' }}>{etaStr}</strong>
                </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
    );
}

function AddressSearchBox({ onSelect, disabled }) {
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const debounceRef = useRef(null);

    const search = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        if (val.trim().length < 3) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try { const data = await geocodeAddress(val); setResults(data.slice(0, 5)); }
            catch { setResults([]); }
            setLoading(false);
        }, 500);
    };

    const pick = (item) => {
        setQuery(item.display_name.split(',').slice(0, 2).join(','));
        setResults([]);
        onSelect([parseFloat(item.lat), parseFloat(item.lon)], item.display_name.split(',').slice(0, 2).join(','));
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text" value={query}
                    onChange={e => search(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    placeholder="Buscar dirección o lugar…"
                    disabled={disabled}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: disabled ? '#f9fafb' : '#fff', color: '#111827', boxSizing: 'border-box' }}
                />
                {loading && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>⟳</span>}
            </div>
            {focused && results.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 2000, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: 4, overflow: 'hidden' }}>
                    {results.map((r, i) => (
                        <div key={i} onMouseDown={() => pick(r)}
                            style={{ padding: '8px 12px', fontSize: 12, color: '#374151', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                            📍 {r.display_name.split(',').slice(0, 3).join(', ')}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const sBtn = {
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    fontWeight: 600, padding: '9px 14px', display: 'flex',
    alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
};

const AdvancedMapComponent = () => {
    const { token } = storeAuth();

    const BASE_URL = (() => {
        const url = import.meta.env.VITE_BACKEND_URL || '';
        return url.endsWith('/api') ? url : `${url}/api`;
    })();

    const axiosAuth = (() => {
        const instance = axios.create({ baseURL: BASE_URL });
        instance.interceptors.request.use((config) => {
            const t = token || localStorage.getItem('token');
            if (t) config.headers.Authorization = `Bearer ${t}`;
            return config;
        });
        return instance;
    })();

    const [rutasData,            setRutasData]            = useState({});
    const [txtLoaded,            setTxtLoaded]            = useState(false);
    const [isDraggingTxt,        setIsDraggingTxt]        = useState(false);
    const txtFileRef = useRef(null);

    const [activePanel,          setActivePanel]          = useState('importar');
    const [selectedRoute,        setSelectedRoute]        = useState(null);
    const [selectedPoint,        setSelectedPoint]        = useState(null);
    const [mapCenter,            setMapCenter]            = useState([-0.26, -78.52]);
    const [mapZoom,              setMapZoom]              = useState(12);
    const [isMobile,             setIsMobile]             = useState(window.innerWidth < 768);
    const [isRutaMenuOpen,       setIsRutaMenuOpen]       = useState(true);
    const [isPuntosMenuOpen,     setIsPuntosMenuOpen]     = useState(false);

    const [userLocation,         setUserLocation]         = useState(null);
    const [destination,          setDestination]          = useState(null);
    const [destName,             setDestName]             = useState('');
    const [isSettingDest,        setIsSettingDest]        = useState(false);
    const [routeInfo,            setRouteInfo]            = useState(null);
    const [locationError,        setLocationError]        = useState(null);
    const [locating,             setLocating]             = useState(false);
    const watchIdRef = useRef(null);

    const [buildMode,            setBuildMode]            = useState(false);
    const [buildStops,           setBuildStops]           = useState([]);
    const [buildRouteName,       setBuildRouteName]       = useState('');
    const [buildRouteColor,      setBuildRouteColor]      = useState('#3b82f6');
    const [editingStopIdx,       setEditingStopIdx]       = useState(null);
    const [editingStopName,      setEditingStopName]      = useState('');
    const [savingRoute,          setSavingRoute]          = useState(false);
    const [message,              setMessage]              = useState({ type: '', text: '' });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    };

    const processTxtFile = (file) => {
        if (!file || !file.name.endsWith('.txt')) {
            showMsg('error', 'Solo se admiten archivos .txt');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const parsed = parseTxtToRutasData(e.target.result);
            const keys = Object.keys(parsed);
            if (keys.length === 0) {
                showMsg('error', 'No se encontraron rutas válidas. Revisa el formato del archivo.');
                return;
            }
            setRutasData(parsed);
            setSelectedRoute(keys[0]);
            setMapCenter(parsed[keys[0]].stops[0]?.position ?? [-0.26, -78.52]);
            setMapZoom(13);
            setTxtLoaded(true);
            setActivePanel('ver');
            showMsg('success', `${keys.length} ruta${keys.length > 1 ? 's' : ''} importada${keys.length > 1 ? 's' : ''} correctamente`);
        };
        reader.readAsText(file, 'utf-8');
    };

    const startTracking = () => {
        if (!navigator.geolocation) { setLocationError('Tu navegador no soporta geolocalización.'); return; }
        setLocating(true); setLocationError(null);
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const c = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(c); setMapCenter(c); setMapZoom(15); setLocating(false);
            },
            () => { setLocationError('No se pudo obtener tu ubicación.'); setLocating(false); },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
    };

    const stopTracking = () => {
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setUserLocation(null); setDestination(null); setDestName(''); setRouteInfo(null); setIsSettingDest(false);
    };

    useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

    const handleAddStop = useCallback((coords) => {
        const autoName = `Parada ${buildStops.length + 1}`;
        setBuildStops(prev => [...prev, { position: coords, name: autoName }]);
    }, [buildStops.length]);

    const handleSetDestination = useCallback((coords) => {
        setDestination(coords); setDestName(''); setRouteInfo(null); setIsSettingDest(false);
        getOsrmRoute(userLocation, coords)
            .then(r => setRouteInfo({ distance: r.distance, duration: r.duration }))
            .catch(() => {});
    }, [userLocation]);

    const handleAddressSelect = (coords, name) => {
        setDestination(coords); setDestName(name); setRouteInfo(null);
        setMapCenter(coords); setMapZoom(15);
        if (userLocation) {
            getOsrmRoute(userLocation, coords)
                .then(r => setRouteInfo({ distance: r.distance, duration: r.duration }))
                .catch(() => {});
        }
    };

    const clearDestination = () => { setDestination(null); setDestName(''); setRouteInfo(null); setIsSettingDest(false); };

    const updateStopName = (idx, name) => {
        setBuildStops(prev => prev.map((s, i) => i === idx ? { ...s, name } : s));
        setEditingStopIdx(null); setEditingStopName('');
    };

    const removeStop = (idx) => setBuildStops(prev => prev.filter((_, i) => i !== idx));

    const handleSaveRoute = async () => {
        if (!buildRouteName.trim()) { showMsg('error', 'Ingresa un nombre para la ruta'); return; }
        if (buildStops.length < 2) { showMsg('error', 'Agrega al menos 2 paradas'); return; }
        setSavingRoute(true);
        try {
            const resRuta = await axiosAuth.post('/admin/bus/rutas', {
                nombre: buildRouteName.trim(), color: buildRouteColor, activo: true,
            });
            const rutaId = resRuta.data.data?._id || resRuta.data._id;
            for (let i = 0; i < buildStops.length; i++) {
                await axiosAuth.post('/admin/bus/paradas', {
                    ruta_id: rutaId, nombre: buildStops[i].name,
                    latitud: buildStops[i].position[0], longitud: buildStops[i].position[1], orden: i,
                });
            }
            showMsg('success', `Ruta "${buildRouteName}" guardada con ${buildStops.length} paradas`);
            setBuildStops([]); setBuildRouteName(''); setBuildMode(false);
        } catch (err) {
            const msg = err.response?.status === 401 ? 'Sesión expirada' : err.response?.data?.message || 'Error al guardar';
            showMsg('error', msg);
        } finally { setSavingRoute(false); }
    };

    const mapMode = buildMode ? 'addStop' : isSettingDest ? 'setDest' : 'view';
    const currentRoute = rutasData[selectedRoute] ?? null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            height: isMobile ? 'auto' : '100dvh',
            minHeight: isMobile ? 'auto' : 0,
            overflow: 'hidden',
            fontFamily: 'system-ui,sans-serif',
        }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                .adv-sidebar::-webkit-scrollbar { width: 4px; }
                .adv-sidebar::-webkit-scrollbar-track { background: transparent; }
                .adv-sidebar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                .leaflet-tooltip { background: rgba(255,255,255,0.95) !important; border: 1px solid #e5e7eb !important; border-radius: 6px !important; padding: 3px 8px !important; font-size: 11px !important; font-weight: 600 !important; color: #1e40af !important; box-shadow: 0 2px 8px rgba(0,0,0,.12) !important; white-space: nowrap; }
                .leaflet-tooltip-left::before, .leaflet-tooltip-right::before { border: none !important; }
            `}</style>

            {/* Toast */}
            {message.text && (
                <div style={{
                    position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: message.type === 'error' ? '#dc2626' : '#16a34a',
                    border: `1.5px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`,
                    boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                }}>
                    {message.type === 'error' ? '❌' : '✅'} {message.text}
                </div>
            )}

            {/* ──────────────── SIDEBAR ──────────────── */}
            <div className="adv-sidebar" style={{
                width: isMobile ? '100%' : 290,
                flexShrink: 0,
                height: isMobile ? 'auto' : '100%',
                maxHeight: isMobile ? 320 : '100%',
                overflowY: 'auto', overflowX: 'hidden',
                display: 'flex', flexDirection: 'column', gap: 0,
                borderRight: isMobile ? 'none' : '1px solid #e5e7eb',
                borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
                background: '#f8faff',
                order: isMobile ? 2 : 1,
            }}>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
                    {[
                        { key: 'importar', label: '📥 Importar' },
                        { key: 'ver',      label: '🗺️ Ver',     disabled: !txtLoaded },
                        { key: 'navegar',  label: '🧭 Navegar' },
                        { key: 'crear',    label: '✏️ Crear' },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => { if (!tab.disabled) { setActivePanel(tab.key); setBuildMode(false); } }}
                            title={tab.disabled ? 'Importa un archivo .txt primero' : undefined}
                            style={{
                                flex: 1, padding: '10px 2px', border: 'none', cursor: tab.disabled ? 'not-allowed' : 'pointer',
                                fontSize: 11, fontWeight: 600,
                                background: activePanel === tab.key ? '#1d4ed8' : '#fff',
                                color: tab.disabled ? '#d1d5db' : activePanel === tab.key ? '#fff' : '#6b7280',
                                borderBottom: activePanel === tab.key ? '2px solid #1d4ed8' : '2px solid transparent',
                                minWidth: 60,
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {activePanel === 'importar' && (
                        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{
                                padding: '12px 14px',
                                background: 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                                color: '#fff',
                            }}>
                                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
                                    🗂️ IMPORTAR RUTAS PREDEFINIDAS
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.85 }}>
                                    Sube un archivo .txt con tus rutas
                                </div>
                            </div>

                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                                {/* Zona drag & drop */}
                                <div
                                    onDragOver={e => { e.preventDefault(); setIsDraggingTxt(true); }}
                                    onDragLeave={() => setIsDraggingTxt(false)}
                                    onDrop={e => { e.preventDefault(); setIsDraggingTxt(false); processTxtFile(e.dataTransfer.files[0]); }}
                                    onClick={() => txtFileRef.current.click()}
                                    style={{
                                        border: `2px dashed ${isDraggingTxt ? '#2563eb' : '#bfdbfe'}`,
                                        borderRadius: 10, padding: '20px 10px',
                                        textAlign: 'center', cursor: 'pointer',
                                        background: isDraggingTxt ? '#eff6ff' : '#f8faff',
                                        transition: 'all .15s',
                                    }}
                                >
                                    <div style={{ fontSize: 28, marginBottom: 5 }}>📂</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
                                        {txtLoaded ? '🔄 Reemplazar archivo' : 'Subir archivo .txt'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                                        Arrastra aquí o haz clic
                                    </div>
                                    <input
                                        ref={txtFileRef} type="file" accept=".txt"
                                        style={{ display: 'none' }}
                                        onChange={e => { processTxtFile(e.target.files[0]); e.target.value = ''; }}
                                    />
                                </div>

                                {/* Estado cargado */}
                                {txtLoaded && (
                                    <div style={{
                                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                                        borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534',
                                    }}>
                                        ✅ <strong>{Object.keys(rutasData).length} rutas cargadas</strong>
                                        <br />
                                        <span style={{ fontSize: 11, color: '#15803d' }}>
                                            Ve a la pestaña <strong>🗺️ Ver</strong> para visualizarlas
                                        </span>
                                    </div>
                                )}

                                {/* Formato */}
                                <details style={{ fontSize: 11, color: '#6b7280' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151', padding: '4px 0' }}>
                                        📋 Ver formato del archivo
                                    </summary>
                                    <pre style={{
                                        margin: '6px 0 0', padding: '8px 10px',
                                        background: '#f8faff', borderRadius: 8,
                                        border: '1px solid #e0e7ff', fontSize: 10.5,
                                        lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#374151',
                                    }}>{`RUTA: Nombre de la ruta
                                        COLOR: #3b82f6
                                        PARADA: Nombre | lat | lng
                                        PARADA: Nombre | lat | lng

                                        RUTA: Otra ruta
                                        COLOR: #10b981
                                        PARADA: Nombre | lat | lng`}
                                    </pre>
                                </details>

                                {txtLoaded && (
                                    <button
                                        onClick={() => { setActivePanel('ver'); }}
                                        style={{ ...sBtn, background: '#1d4ed8', color: '#fff' }}>
                                        🗺️ Ver rutas en el mapa →
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {activePanel === 'ver' && (
                        <>
                            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                <div onClick={() => setIsRutaMenuOpen(s => !s)}
                                    style={{ padding: '11px 14px', cursor: 'pointer', background: '#f0f4ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>🚌 Rutas de Bus</span>
                                    <span style={{ fontSize: 10, color: '#6b7280' }}>{isRutaMenuOpen ? '▲' : '▼'}</span>
                                </div>
                                {isRutaMenuOpen && (
                                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {Object.keys(rutasData).length === 0 ? (
                                            <div style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                                                Sin rutas. Ve a <strong>📥 Importar</strong>.
                                            </div>
                                        ) : Object.keys(rutasData).map(key => (
                                            <div key={key}
                                                onClick={() => { setSelectedRoute(key); setMapCenter(rutasData[key].stops[0].position); setMapZoom(13); }}
                                                style={{
                                                    padding: '8px 11px', cursor: 'pointer', borderRadius: 7,
                                                    background: selectedRoute === key ? '#eff6ff' : '#fff',
                                                    border: selectedRoute === key ? '1.5px solid #bfdbfe' : '1px solid #f3f4f6',
                                                    fontSize: 12,
                                                    color: selectedRoute === key ? '#1d4ed8' : '#374151',
                                                    fontWeight: selectedRoute === key ? 600 : 400,
                                                    display: 'flex', alignItems: 'center', gap: 7,
                                                }}>
                                                <span style={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: rutasData[key].color, flexShrink: 0,
                                                }} />
                                                {rutasData[key].name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                <div onClick={() => setIsPuntosMenuOpen(s => !s)}
                                    style={{ padding: '11px 14px', cursor: 'pointer', background: '#fff8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#b45309' }}>🏛️ Puntos Estratégicos</span>
                                    <span style={{ fontSize: 10, color: '#6b7280' }}>{isPuntosMenuOpen ? '▲' : '▼'}</span>
                                </div>
                                {isPuntosMenuOpen && (
                                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {puntosEstrategicos.map(punto => (
                                            <div key={punto.id}
                                                onClick={() => { setSelectedPoint(punto.id); setMapCenter(punto.position); setMapZoom(17); }}
                                                style={{
                                                    padding: '8px 11px', cursor: 'pointer', borderRadius: 7,
                                                    background: selectedPoint === punto.id ? '#fff8f0' : '#fff',
                                                    border: selectedPoint === punto.id ? '1.5px solid #fed7aa' : '1px solid #f3f4f6',
                                                    fontSize: 12, color: '#374151',
                                                }}>
                                                {punto.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activePanel === 'navegar' && (
                        <>
                            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                <div style={{ padding: '11px 14px', background: '#f0f4ff', borderBottom: '1px solid #e5e7eb' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>📍 Mi Ubicación</span>
                                </div>
                                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {!userLocation ? (
                                        <button style={{ ...sBtn, background: '#2563eb', color: '#fff' }} onClick={startTracking} disabled={locating}>
                                            {locating ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Localizando…</> : <>🎯 Activar ubicación</>}
                                        </button>
                                    ) : (
                                        <>
                                            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#166534', border: '1px solid #bbf7d0' }}>
                                                ✅ <strong>Ubicación activa</strong><br />
                                                <span style={{ color: '#15803d', fontSize: 11 }}>{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</span>
                                            </div>
                                            <button style={{ ...sBtn, background: '#fee2e2', color: '#dc2626' }} onClick={stopTracking}>⛔ Detener seguimiento</button>
                                        </>
                                    )}
                                    {locationError && (
                                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626' }}>⚠️ {locationError}</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                <div style={{ padding: '11px 14px', background: '#fff8f8', borderBottom: '1px solid #e5e7eb' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#b91c1c' }}>🏁 Destino</span>
                                </div>
                                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <AddressSearchBox onSelect={handleAddressSelect} disabled={!userLocation} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 11 }}>
                                        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} /> o <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                                    </div>
                                    <button
                                        style={{ ...sBtn, background: isSettingDest ? '#fef3c7' : '#f3f4f6', color: isSettingDest ? '#92400e' : '#374151', border: isSettingDest ? '2px solid #f59e0b' : '2px solid transparent' }}
                                        onClick={() => setIsSettingDest(s => !s)} disabled={!userLocation}>
                                        {isSettingDest ? '✋ Toca el mapa…' : '🗺️ Seleccionar en mapa'}
                                    </button>
                                    {destination && (
                                        <>
                                            <div style={{ background: '#fff1f2', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#9f1239', border: '1px solid #fecdd3' }}>
                                                📌 <strong>Destino:</strong><br />
                                                {destName || `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}`}
                                            </div>
                                            {routeInfo && (
                                                <div style={{ background: '#eff6ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                                    ⏱ <strong>{routeInfo.duration} min</strong> · 📏 {routeInfo.distance} km
                                                </div>
                                            )}
                                            <button style={{ ...sBtn, background: '#dcfce7', color: '#16a34a' }} onClick={() => setMapCenter(destination)}>🔍 Centrar en destino</button>
                                            <button style={{ ...sBtn, background: '#fee2e2', color: '#dc2626' }} onClick={clearDestination}>🗑️ Borrar destino</button>
                                        </>
                                    )}
                                    {!userLocation && <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Activa tu ubicación para calcular rutas.</p>}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════ TAB: CREAR ══════════ */}
                    {activePanel === 'crear' && (
                        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <div style={{ padding: '11px 14px', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>✏️ Nueva Ruta</span>
                            </div>
                            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <input
                                    value={buildRouteName} onChange={e => setBuildRouteName(e.target.value)}
                                    placeholder="Nombre de la ruta…"
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Color:</label>
                                    <input type="color" value={buildRouteColor} onChange={e => setBuildRouteColor(e.target.value)}
                                        style={{ width: 36, height: 30, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                                    <span style={{ fontSize: 11, color: '#6b7280' }}>{buildRouteColor}</span>
                                </div>
                                <button
                                    onClick={() => setBuildMode(s => !s)}
                                    style={{ ...sBtn, background: buildMode ? '#fef3c7' : '#059669', color: buildMode ? '#92400e' : '#fff', border: buildMode ? '2px solid #f59e0b' : '2px solid transparent' }}>
                                    {buildMode ? '✋ Toca el mapa para agregar…' : '🗺️ Agregar paradas en el mapa'}
                                </button>
                                {buildStops.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            Paradas ({buildStops.length})
                                        </p>
                                        {buildStops.map((stop, idx) => (
                                            <div key={idx} style={{ background: '#f8faff', borderRadius: 8, padding: '7px 10px', border: '1px solid #e0e7ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: idx === 0 ? '#16a34a' : idx === buildStops.length - 1 ? '#dc2626' : buildRouteColor, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {idx + 1}
                                                </div>
                                                {editingStopIdx === idx ? (
                                                    <input autoFocus value={editingStopName}
                                                        onChange={e => setEditingStopName(e.target.value)}
                                                        onBlur={() => updateStopName(idx, editingStopName || stop.name)}
                                                        onKeyDown={e => { if (e.key === 'Enter') updateStopName(idx, editingStopName || stop.name); }}
                                                        style={{ flex: 1, padding: '3px 7px', borderRadius: 5, border: '1.5px solid #6366f1', fontSize: 12, outline: 'none' }} />
                                                ) : (
                                                    <span onClick={() => { setEditingStopIdx(idx); setEditingStopName(stop.name); }}
                                                        style={{ flex: 1, fontSize: 12, color: '#374151', cursor: 'pointer', borderBottom: '1px dashed #c7d2fe' }}
                                                        title="Clic para editar nombre">
                                                        {stop.name}
                                                    </span>
                                                )}
                                                <button onClick={() => removeStop(idx)}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1, padding: 2, flexShrink: 0 }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {buildStops.length >= 2 && (
                                    <button onClick={handleSaveRoute} disabled={savingRoute}
                                        style={{ ...sBtn, background: savingRoute ? '#86efac' : '#16a34a', color: '#fff' }}>
                                        {savingRoute ? '⟳ Guardando…' : '💾 Guardar Ruta'}
                                    </button>
                                )}
                                {buildStops.length > 0 && (
                                    <button onClick={() => { setBuildStops([]); setBuildMode(false); }}
                                        style={{ ...sBtn, background: '#fee2e2', color: '#dc2626' }}>
                                        🗑️ Limpiar paradas
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* ──────────────── MAPA ──────────────── */}
            <div style={{ flex: 1, position: 'relative', minHeight: isMobile ? 400 : 0, minWidth: 0, order: isMobile ? 1 : 2 }}>

                {buildMode && (
                    <div style={{
                        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 1000, background: '#f0fdf4', borderRadius: 8, padding: '8px 18px',
                        fontSize: 13, fontWeight: 600, color: '#166534',
                        boxShadow: '0 4px 12px rgba(0,0,0,.15)', border: '1.5px solid #86efac',
                        pointerEvents: 'none', whiteSpace: 'nowrap',
                    }}>
                        🗺️ Toca el mapa para agregar parada {buildStops.length + 1}
                    </div>
                )}

                {isSettingDest && !buildMode && (
                    <div style={{
                        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 1000, background: '#fef3c7', borderRadius: 8, padding: '8px 18px',
                        fontSize: 13, fontWeight: 600, color: '#92400e',
                        boxShadow: '0 4px 12px rgba(0,0,0,.15)', border: '1.5px solid #f59e0b',
                        pointerEvents: 'none',
                    }}>
                        🗺️ Toca el mapa para fijar tu destino
                    </div>
                )}

                {/* Banner "sin rutas" en pestaña Ver */}
                {activePanel === 'ver' && !txtLoaded && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%,-50%)', zIndex: 500,
                        background: 'rgba(255,255,255,.92)', borderRadius: 14,
                        padding: '24px 32px', textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0,0,0,.12)',
                        border: '1.5px solid #e0e7ff', pointerEvents: 'none',
                    }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                        <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 14, marginBottom: 4 }}>
                            No hay rutas cargadas
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>
                            Ve a <strong>📥 Importar</strong> y sube un archivo .txt
                        </div>
                    </div>
                )}

                {routeInfo && destination && activePanel === 'navegar' && (
                    <ETABanner routeInfo={routeInfo} destination={destination} destName={destName} onClose={clearDestination} />
                )}

                <MapContainer
                    center={mapCenter} zoom={mapZoom}
                    style={{ height: '100%', width: '100%' }}
                >
                    <MapUpdater center={mapCenter} zoom={userLocation ? 15 : 12} />
                    <FitBounds points={allPoints} />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapClickHandler mode={mapMode} onAddStop={handleAddStop} onSetDestination={handleSetDestination} />

                    {userLocation && (
                        <Marker position={userLocation} icon={userLocationIcon}>
                            <Popup><strong>📍 Tu ubicación actual</strong><br /><span style={{ color: '#6b7280', fontSize: 11 }}>{userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}</span></Popup>
                        </Marker>
                    )}

                    {destination && (
                        <Marker position={destination} icon={destinationIcon}>
                            <Popup>
                                <strong>🏁 {destName || 'Destino'}</strong><br />
                                <span style={{ color: '#6b7280', fontSize: 11 }}>{destination[0].toFixed(6)}, {destination[1].toFixed(6)}</span>
                                {routeInfo && <div style={{ marginTop: 6, color: '#2563eb', fontWeight: 600 }}>⏱ {routeInfo.duration} min · {routeInfo.distance} km</div>}
                            </Popup>
                        </Marker>
                    )}

                    {userLocation && destination && activePanel === 'navegar' && (
                        <RoutePolyline stops={[{ position: userLocation }, { position: destination }]} color="#2563eb" />
                    )}

                    {/* Ruta seleccionada */}
                    {activePanel === 'ver' && currentRoute && (
                        <>
                            <RoutePolyline stops={currentRoute.stops} color={currentRoute.color} />
                            {currentRoute.stops.map((stop, idx) => (
                                <CircleMarker key={stop.id} center={stop.position}
                                    radius={idx === 0 || idx === currentRoute.stops.length - 1 ? 10 : 7}
                                    pathOptions={{
                                        color: idx === 0 ? '#16a34a' : idx === currentRoute.stops.length - 1 ? '#dc2626' : currentRoute.color,
                                        fillColor: '#fff', fillOpacity: 1, weight: 2.5,
                                    }}>
                                    <Tooltip permanent direction="top" offset={[0, -6]}>{stop.name}</Tooltip>
                                    <Popup>
                                        <strong>{stop.name}</strong><br />
                                        <span style={{ fontSize: 11, color: '#6b7280' }}>Parada {idx + 1} · {currentRoute.name}</span>
                                    </Popup>
                                </CircleMarker>
                            ))}
                        </>
                    )}

                    {/* Puntos estratégicos */}
                    {puntosEstrategicos.map(punto => (
                        <CircleMarker key={punto.id} center={punto.position} radius={10}
                            pathOptions={{ color: selectedPoint === punto.id ? '#f59e0b' : '#ef4444', fillColor: selectedPoint === punto.id ? '#fde68a' : '#fca5a5', fillOpacity: 0.9, weight: 2 }}>
                            <Tooltip permanent direction="top" offset={[0, -8]}>{punto.name}</Tooltip>
                            <Popup><strong>{punto.name}</strong></Popup>
                        </CircleMarker>
                    ))}

                    {/* Constructor de rutas */}
                    {activePanel === 'crear' && buildStops.length > 0 && (
                        <>
                            <RoutePolyline stops={buildStops} color={buildRouteColor} />
                            {buildStops.map((stop, idx) => (
                                <CircleMarker key={idx} center={stop.position}
                                    radius={idx === 0 || idx === buildStops.length - 1 ? 10 : 7}
                                    pathOptions={{
                                        color: idx === 0 ? '#16a34a' : idx === buildStops.length - 1 ? '#dc2626' : buildRouteColor,
                                        fillColor: '#fff', fillOpacity: 1, weight: 2.5,
                                    }}>
                                    <Tooltip permanent direction="top" offset={[0, -6]}>{stop.name}</Tooltip>
                                    <Popup>
                                        <strong>{stop.name}</strong><br />
                                        <span style={{ fontSize: 11, color: '#6b7280' }}>Parada {idx + 1}</span><br />
                                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{stop.position[0].toFixed(5)}, {stop.position[1].toFixed(5)}</span>
                                    </Popup>
                                </CircleMarker>
                            ))}
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default AdvancedMapComponent;
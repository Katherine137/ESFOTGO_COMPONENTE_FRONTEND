import { Link } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import MapComponent from '../components/map/MapComponent';

export const Map = () => {
return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
    <header style={{
        backgroundColor: '#234094',
        color: 'white',
        padding: '10px 15px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
        <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
        }}>
            <MapIcon
                size={30}
                color="white"
                strokeWidth={2}
                style={{ flexShrink: 0 }}
            />
            <h1 style={{ margin: 0, fontSize: 'clamp(12px, 2vw, 20px)', lineHeight: 1.5, fontWeight: 600}}>
            ¡Explora cada espacio en una experiencia inmersiva! Haz clic en los recuadros del mapa para descubrir las imágenes panorámicas en 360°.
            </h1>
            {/*
            <nav style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <Link 
            to="/" 
            style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 15px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '5px'
            }}
            >
                Inicio
            </Link>
            <Link 
            to="/login" 
            style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 15px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderRadius: '5px'
            }}
            >
                Login
            </Link>
            </nav>
            */}
        </div>
    </header>

        <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: 'clamp(10px, 3vw, 20px)'
    }}>
        <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: 'clamp(10px, 3vw, 20px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
        <MapComponent />
        </div>
    </main>
    </div>
);
};

export default Map;
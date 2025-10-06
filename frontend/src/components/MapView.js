import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';


// fix Leaflet default icon path
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});


export default function MapView({ places, tileUrl }) {
// center roughly South Bangalore
const center = [12.94, 77.58];
return (
<MapContainer center={center} zoom={13} style={{ height: '70vh', width: '100%' }}>
<TileLayer url={tileUrl} />
{/* {places.map(p => (
<Marker key={p.id} position={[p.lat, p.lng]}>
<Popup>
<strong>{p.displayName || p.name}</strong>
<div style={{ fontSize: '0.85rem' }}>{p.displayName ? '(Kannada)' : '(English)'}</div>
<div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#666' }}>
{p.tags && p.tags.amenity ? p.tags.amenity : ''}
</div>
</Popup>
</Marker>
))} */}
</MapContainer>
);
}
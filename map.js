// إنشاء الخريطة مع تحديد حدود التكبير والتصغير
const map = L.map('map', {
    minZoom: 2,
    maxZoom: 12,
    zoomControl: false,
    preferCanvas: true,
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    wheelDebounceTime: 100,
    fadeAnimation: false,
    zoomAnimation: true,
    markerZoomAnimation: true
}).setView([24.7136, 46.6753], 6);

// إضافة أزرار التحكم في التكبير في الجانب الأيمن
L.control.zoom({
    position: 'topright'
}).addTo(map);

// إضافة طبقة الخريطة الأساسية مع تحسين المظهر
const baseLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
    maxZoom: 12,
    minZoom: 2,
    attribution: '© OpenStreetMap, © CartoDB',
    updateWhenIdle: true,
    keepBuffer: 4,
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);

// تخزين البيانات في الذاكرة المؤقتة
let searchResults = [];
let markers = L.layerGroup();
let areaLabels = L.layerGroup();
let pointsLayer = L.layerGroup();

// تحسين أداء البحث
const searchInput = document.querySelector('.search-input');
const searchResultsContainer = document.querySelector('.search-results');
let searchTimeout;

// تحميل البيانات من ملف JSON
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        // إنشاء طبقات مختلفة للعناصر
        const areasLayer = L.layerGroup();

        // إضافة المناطق
        data.areas.forEach(area => {
            const polygon = L.polygon(area.coordinates, {
                color: '#4299e1',
                weight: 2,
                fillOpacity: 0.03,
                opacity: 0.7,
                smoothFactor: 2
            }).addTo(areasLayer);

            // حساب مركز المضلع بشكل دقيق
            const bounds = polygon.getBounds();
            const center = bounds.getCenter();
            
            // إضافة اسم المنطقة كنقطة ثابتة
            const areaPoint = L.circleMarker(center, {
                radius: 0,
                fillOpacity: 0,
                opacity: 0
            }).bindTooltip(area.name, {
                permanent: true,
                direction: 'center',
                className: 'area-label',
                offset: [0, 0]
            }).addTo(areaLabels);

            // إضافة للبحث
            searchResults.push({
                name: area.name,
                type: 'منطقة',
                coordinates: center,
                element: polygon,
                bounds: bounds
            });
        });

        // تحسين أداء عرض المدن والمواقع
        const addPoint = (item, type) => {
            const point = L.circleMarker(item.coordinates, {
                radius: type === 'city' ? 6 : 4,
                fillColor: type === 'city' ? '#3182ce' : '#e53e3e',
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(pointsLayer);

            // إضافة اسم المدينة أو الموقع كنقطة ثابتة
            const label = L.circleMarker(item.coordinates, {
                radius: 0,
                fillOpacity: 0,
                opacity: 0
            }).bindTooltip(`${item.name}${type === 'city' ? 
                '<div class="location-info">مدينة</div>' : 
                item.type === 'historical' ? '<div class="location-info">موقع تاريخي</div>' : 
                item.type === 'religious' ? '<div class="location-info">موقع ديني</div>' : 
                '<div class="location-info">معلم سياحي</div>'}`, {
                permanent: true,
                direction: 'top',
                className: 'location-label',
                offset: [0, -10]
            }).addTo(pointsLayer);

            point.bindPopup(`
                <strong>${item.name}</strong><br>
                ${type === 'city' ? `عدد السكان: ${item.population.toLocaleString('ar-SA')}` : 
                 `النوع: ${item.type === 'historical' ? 'موقع تاريخي' : 
                          item.type === 'religious' ? 'موقع ديني' : 'معلم سياحي'}`}<br>
                <a href="${item.url}" target="_blank">عرض في خرائط Google</a>
            `);

            searchResults.push({
                name: item.name,
                type: type === 'city' ? 'مدينة' : 'موقع',
                coordinates: item.coordinates,
                element: point
            });
        };

        // إضافة المدن والمواقع بشكل مجمع
        data.cities.forEach(city => addPoint(city, 'city'));
        data.locations.forEach(location => addPoint(location, 'location'));

        // إضافة الطبقات إلى الخريطة
        areasLayer.addTo(map);
        areaLabels.addTo(map);
        pointsLayer.remove();

        // تحسين أداء تحديث الطبقات
        const updateLayers = () => {
            const zoom = map.getZoom();
            if (zoom >= 8) {
                if (map.hasLayer(areaLabels)) {
                    areaLabels.remove();
                    pointsLayer.addTo(map);
                }
            } else {
                if (map.hasLayer(pointsLayer)) {
                    pointsLayer.remove();
                    areaLabels.addTo(map);
                }
            }
        };

        // تحديث الطبقات عند تغيير مستوى التكبير
        map.on('zoomend', updateLayers);
        updateLayers();

        // تحسين أداء البحث
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                if (searchTerm.length < 2) {
                    searchResultsContainer.style.display = 'none';
                    return;
                }

                const filteredResults = searchResults.filter(item => 
                    item.name.includes(searchTerm) || 
                    item.type.includes(searchTerm)
                ).slice(0, 10); // تحديد عدد النتائج

                searchResultsContainer.innerHTML = '';
                filteredResults.forEach(result => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    div.innerHTML = `${result.name} (${result.type})`;
                    div.addEventListener('click', () => {
                        if (result.bounds) {
                            map.fitBounds(result.bounds);
                        } else {
                            map.setView(result.coordinates, 9);
                        }
                        result.element.openPopup();
                        searchResultsContainer.style.display = 'none';
                        searchInput.value = '';
                    });
                    searchResultsContainer.appendChild(div);
                });

                searchResultsContainer.style.display = filteredResults.length ? 'block' : 'none';
            }, 200); // تأخير البحث لتحسين الأداء
        });

        // إخفاء نتائج البحث عند النقر خارج القائمة
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-container')) {
                searchResultsContainer.style.display = 'none';
            }
        });
    })
    .catch(error => console.error('Error loading map data:', error));

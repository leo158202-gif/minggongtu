import { ASTRO_CITIES, ASTRO_ZONES } from '@/lib/astro/place';
import type { AstroHouseSystem, AstroPlaceState } from '@/lib/astro/types';

const HOUSES: { id: AstroHouseSystem; label: string }[] = [
  { id: 'placidus', label: '普拉西德' },
  { id: 'whole_sign', label: '整宫' },
  { id: 'equal', label: '等宫' },
  { id: 'koch', label: '柯赫' },
];

interface AstroPlaceFieldsProps {
  place: AstroPlaceState;
  disabled?: boolean;
  onChange: (patch: Partial<AstroPlaceState>) => void;
  onCommit?: () => void;
}

export default function AstroPlaceFields({ place, disabled, onChange, onCommit }: AstroPlaceFieldsProps) {
  const clearTimeChoice = { dstChoice: null, acceptGapKey: null } as const;
  return (
    <div className="astro-fields" data-testid="astro-place">
      <label className="is-wide">
        地点
        <select
          data-testid="astro-city"
          disabled={disabled}
          value=""
          onChange={event => {
            const city = ASTRO_CITIES.find(item => item.id === event.target.value);
            if (!city) return;
            onChange({
              latitude: String(city.latitude),
              longitude: String(city.longitude),
              zoneChoice: city.zone,
              ...clearTimeChoice,
            });
            onCommit?.();
          }}
        >
          <option value="">选择城市，或在下面改经纬度</option>
          {ASTRO_CITIES.map(city => (
            <option key={city.id} value={city.id}>{city.name}</option>
          ))}
        </select>
      </label>
      <label>
        纬度
        <input
          data-testid="astro-lat"
          inputMode="decimal"
          disabled={disabled}
          value={place.latitude}
          onChange={event => onChange({ latitude: event.target.value, ...clearTimeChoice })}
          onBlur={() => onCommit?.()}
        />
      </label>
      <label>
        经度
        <input
          data-testid="astro-lon"
          inputMode="decimal"
          disabled={disabled}
          value={place.longitude}
          onChange={event => onChange({ longitude: event.target.value, ...clearTimeChoice })}
          onBlur={() => onCommit?.()}
        />
      </label>
      <label>
        时区
        <select
          data-testid="astro-zone"
          disabled={disabled}
          value={place.zoneChoice}
          onChange={event => {
            onChange({ zoneChoice: event.target.value, ...clearTimeChoice });
            onCommit?.();
          }}
        >
          <option value="auto">按经纬度自动判断</option>
          {ASTRO_ZONES.map(zone => (
            <option key={zone.id} value={zone.id}>{zone.label}</option>
          ))}
          <option value="custom">其他 IANA 时区</option>
        </select>
      </label>
      {place.zoneChoice === 'custom' ? (
        <label>
          IANA 时区
          <input
            data-testid="astro-zone-custom"
            disabled={disabled}
            value={place.customZone}
            placeholder="例如 Europe/Berlin"
            onChange={event => onChange({ customZone: event.target.value, ...clearTimeChoice })}
            onBlur={() => onCommit?.()}
          />
        </label>
      ) : <span />}
      <div className="is-wide" role="group" aria-label="宫位制">
        {HOUSES.map(house => (
          <button
            key={house.id}
            type="button"
            disabled={disabled}
            className={place.houseSystem === house.id ? 'is-on' : undefined}
            aria-pressed={place.houseSystem === house.id}
            onClick={() => {
              onChange({ houseSystem: house.id });
              onCommit?.();
            }}
          >
            {house.label}
          </button>
        ))}
      </div>
      <p className="is-wide">
        纬度北正南负，经度东正西负。城市是市中心约数，不是出生医院。中国大陆的钟面时间通常是北京时间；乌鲁木齐如果用新疆当地钟面，要另选乌鲁木齐时间。选「按经纬度自动判断」时，新疆坐标会落到乌鲁木齐时区，请核对钟面。
      </p>
    </div>
  );
}

import { useState } from 'react';

/** Keep the overlay's data available while HeroUI animates it out. */
export function useOverlayData<T>(data: T | null): T | null {
    const [lastData, setLastData] = useState(data);

    if (data !== null && data !== lastData) {
        setLastData(data);
    }

    return data ?? lastData;
}

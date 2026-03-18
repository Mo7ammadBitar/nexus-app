import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint = 768) => {
    // Initialize with current window width if available
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth <= breakpoint;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setIsMobile(window.innerWidth <= breakpoint);
        };

        window.addEventListener('resize', handleResize);
        
        // Check once on mount
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
};

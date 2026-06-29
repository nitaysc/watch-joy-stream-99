import { useState, useEffect } from "react";

export type Server = {
  name: string;
  url: string;
};

export function useServerPing(servers: Server[], prioritizeAnime: boolean = false) {
  const [pings, setPings] = useState<Record<string, number | null>>({});
  const [checking, setChecking] = useState(true);
  const [bestIndex, setBestIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    const checkServers = async () => {
      setChecking(true);
      const results: Record<string, number | null> = {};
      
      const promises = servers.map(async (server) => {
        const start = Date.now();
        try {
          // abort after 3 seconds
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 3000);
          await fetch(server.url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
          clearTimeout(id);
          if (mounted) results[server.name] = Date.now() - start;
        } catch (e) {
          if (mounted) results[server.name] = null;
        }
      });

      await Promise.allSettled(promises);
      
      if (!mounted) return;
      
      setPings(results);
      setChecking(false);

      if (prioritizeAnime && results["AnimeX"] !== null) {
        setBestIndex(servers.findIndex(s => s.name === "AnimeX"));
        return;
      }

      let bestIdx = 0;
      let minPing = Infinity;

      servers.forEach((server, i) => {
        const ping = results[server.name];
        if (ping !== null && ping < minPing) {
          minPing = ping;
          bestIdx = i;
        }
      });
      
      if (minPing !== Infinity) {
        setBestIndex(bestIdx);
      } else {
        setBestIndex(prioritizeAnime ? servers.findIndex(s => s.name === "AnimeX") : 0);
      }
    };

    if (servers.length > 0 && servers[0].url) {
      checkServers();
    }

    return () => {
      mounted = false;
    };
  }, [servers.map(s => s.url).join(",")]);

  return { pings, checking, bestIndex, setBestIndex };
}

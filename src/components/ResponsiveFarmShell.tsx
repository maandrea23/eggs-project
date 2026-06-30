"use client";

import { useEffect, useState } from "react";
import FarmAdminPage from "@/components/FarmAdminPage";
import FarmApp from "@/components/FarmApp";

const PHONE_MEDIA_QUERY = "(max-width: 767px)";

export default function ResponsiveFarmShell() {
  const [isPhoneSized, setIsPhoneSized] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(PHONE_MEDIA_QUERY);
    const syncDeviceSize = () => setIsPhoneSized(mediaQuery.matches);

    syncDeviceSize();
    mediaQuery.addEventListener("change", syncDeviceSize);

    return () => mediaQuery.removeEventListener("change", syncDeviceSize);
  }, []);

  if (isPhoneSized === null) {
    return null;
  }

  return isPhoneSized ? <FarmApp /> : <FarmAdminPage />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CalendarDays, ChevronDown, ClipboardList, FileText, Heart, House, Map, MessageCircle, PawPrint, UserRound, UsersRound } from "lucide-react";

const primary = [["explore", Map, "Find pets"], ["favorites", Heart, "Saved"], ["applications", ClipboardList, "Applications"], ["messages", MessageCircle, "Messages"]];
const more = [["profile", UserRound, "My profile"], ["home", House, "Adoption plan"], ["match", PawPrint, "Match quiz"], ["events", CalendarDays, "Adoption events"], ["community", UsersRound, "Community"], ["resources", FileText, "Adoption guides"], ["shelter", Building2, "Shelters & fosters"]];

export default function MapNavigation({ activePanel, savedCount, onNavigate, onSubmit, accountAction }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (event.type === "keydown" && event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (event.type === "pointerdown" && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", dismiss); };
  }, [open]);
  const navigate = panel => { setOpen(false); onNavigate(panel); };
  const moreActive = more.some(([key]) => key === activePanel);
  return <header className="map-app-header">
    <a className="brand" href="/" onClick={event => { event.preventDefault(); navigate("explore"); }} aria-label="Pawline map"><span className="brand-mark"><PawPrint /></span><span>Pawline</span></a>
    <nav className="map-navigation" aria-label="Pawline navigation">
      {primary.map(([key, Icon, label]) => <button key={key} type="button" onClick={() => navigate(key)} aria-current={activePanel === key || (key === "messages" && activePanel === "application-messages") ? "page" : undefined}><Icon /><span>{label}</span>{key === "favorites" && savedCount > 0 ? <small>{savedCount}</small> : null}</button>)}
      <div className="map-nav-more" ref={menuRef}>
        <button ref={triggerRef} type="button" className={moreActive ? "is-active" : ""} aria-expanded={open} aria-controls="map-more-menu" onClick={() => setOpen(value => !value)}><span>More</span><ChevronDown /></button>
        {open ? <div id="map-more-menu" className="map-more-menu">
          {more.map(([key, Icon, label]) => <button key={key} type="button" aria-current={activePanel === key ? "page" : undefined} onClick={() => navigate(key)}><Icon />{label}</button>)}
          <button type="button" onClick={() => { setOpen(false); onSubmit(); }}><PawPrint />List a pet</button>
        </div> : null}
      </div>
    </nav>
    <div className="map-app-actions">{accountAction}<button className="button map-submit" type="button" onClick={onSubmit}><PawPrint /><span>List a pet</span></button></div>
  </header>;
}

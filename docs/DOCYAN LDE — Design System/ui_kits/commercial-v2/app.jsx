/* DOCYAN sitio público v2 — shell.
   Router, contextos (idioma + banda), banner geo, linkout, tweaks. */

function SiteApp() {
  const [tweaks, setTweak] = useTweaks({
    heroVariant: "A",
    accent: "#CF4124",
    density: 1,
  });

  const [page, setPage] = useState(() => {
    try { return localStorage.getItem("docyan_v2_page") || "home"; } catch (e) { return "home"; }
  });
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("docyan_v2_lang") || "es"; } catch (e) { return "es"; }
  });
  const [band, setBand] = useState(() => {
    try { return localStorage.getItem("docyan_v2_band") || "A"; } catch (e) { return "A"; }
  });
  const [banner, setBanner] = useState(() => {
    try { return !localStorage.getItem("docyan_v2_banner_seen"); } catch (e) { return true; }
  });
  const [route, setRoute] = useState(null); // linkout modal

  useEffect(() => { try { localStorage.setItem("docyan_v2_page", page); } catch (e) {} }, [page]);
  useEffect(() => { try { localStorage.setItem("docyan_v2_lang", lang); } catch (e) {} }, [lang]);
  useEffect(() => { try { localStorage.setItem("docyan_v2_band", band); } catch (e) {} }, [band]);

  const go = (p) => { setPage(p); window.scrollTo({ top: 0 }); };
  const dismissBanner = () => { setBanner(false); try { localStorage.setItem("docyan_v2_banner_seen", "1"); } catch (e) {} };

  useEffect(() => {
    document.documentElement.style.setProperty("--cinnabar-500", tweaks.accent);
    document.documentElement.lang = lang;
  }, [tweaks.accent, lang]);

  let content;
  if (page === "home") content = <HomePage go={go} heroVariant={tweaks.heroVariant} />;
  else if (page === "producto") content = <ProductoPage go={go} />;
  else if (page === "como") content = <ComoPage go={go} />;
  else if (page === "verticales") content = <VerticalesHub go={go} />;
  else if (page.indexOf("vert:") === 0) content = <VerticalPage vkey={page.slice(5)} go={go} />;
  else if (page === "seguridad") content = <SeguridadPage go={go} />;
  else if (page === "precios") content = <PreciosPage go={go} />;
  else if (page === "demos" || page.indexOf("demos:") === 0) content = <DemosPage go={go} initial={page.indexOf("demos:") === 0 ? page.slice(6) : null} />;
  else if (page === "legal") content = <LegalPage />;
  else content = <HomePage go={go} heroVariant={tweaks.heroVariant} />;

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <BandCtx.Provider value={{ band, setBand }}>
        <LinkOutCtx.Provider value={setRoute}>
          {banner && <GeoBanner onDismiss={dismissBanner} />}
          <Nav2 page={page} go={go} />
          {content}
          <Footer2 go={go} />
          <LinkOutModal route={route} onClose={() => setRoute(null)} />
          <TweaksPanel title="Tweaks">
            <TweakSection title="Hero de la home">
              <TweakRadio
                label="Variante"
                value={tweaks.heroVariant}
                options={[
                  { value: "A", label: "A · Split" },
                  { value: "B", label: "B · Pregunta" },
                  { value: "C", label: "C · Campo" },
                ]}
                onChange={(v) => setTweak("heroVariant", v)}
              />
            </TweakSection>
            <TweakSection title="Marca">
              <TweakColor
                label="Acento (cinnabar)"
                value={tweaks.accent}
                options={["#CF4124", "#B73A20", "#E04E2E"]}
                onChange={(v) => setTweak("accent", v)}
              />
            </TweakSection>
          </TweaksPanel>
        </LinkOutCtx.Provider>
      </BandCtx.Provider>
    </LangCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SiteApp />);

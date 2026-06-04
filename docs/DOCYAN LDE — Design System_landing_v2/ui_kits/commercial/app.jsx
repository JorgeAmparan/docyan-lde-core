/* DOCYAN commercial kit — app shell. */

function CommApp() {
  const [page, setPage] = useState("landing");
  const [region, setRegion] = useState("MX");
  const go = (p) => { setPage(p); window.scrollTo(0, 0); };

  const PRIMARY = [["landing", "Landing"], ["pricing", "Precios"], ["signup", "Signup"], ["account", "Cuenta"]];
  const SECONDARY = [["vertical", "Vertical"], ["how", "Cómo funciona"], ["security", "Seguridad"], ["about", "Acerca de"], ["status", "Estado"], ["support", "Soporte"], ["landing-v1", "Landing v1"]];

  const withNav = ["landing", "landing-v1", "pricing", "signup", "vertical", "how", "security", "about", "status", "support"];

  return (
    <div>
      <div className="kit-switch">
        {PRIMARY.map(([k, l]) => <button key={k} className={page === k ? "on" : ""} onClick={() => go(k)}>{l}</button>)}
        <span className="ks-div" />
        {SECONDARY.map(([k, l]) => <button key={k} className={page === k ? "on" : ""} onClick={() => go(k)}>{l}</button>)}
      </div>

      {withNav.includes(page) && <Nav go={go} />}

      {page === "landing" && <LandingFlow go={go} />}
      {page === "landing-v1" && <Landing go={go} />}
      {page === "pricing" && <Pricing go={go} region={region} setRegion={setRegion} />}
      {page === "signup" && <Signup go={go} region={region} />}
      {page === "account" && <Account go={go} />}
      {page === "vertical" && <VerticalPage go={go} />}
      {page === "how" && <HowPage go={go} />}
      {page === "security" && <SecurityPage go={go} />}
      {page === "about" && <AboutPage go={go} />}
      {page === "status" && <StatusPage go={go} />}
      {page === "support" && <SupportPage go={go} />}
      {page.indexOf("demo:") === 0 && <DemoConsult go={go} vkey={page.split(":")[1]} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<CommApp />);

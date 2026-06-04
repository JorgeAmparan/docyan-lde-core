/* DOCYAN PWA kit — app shell: view switcher + collaborator phone + admin desktop. */

function PhoneFrame({ children }) {
  return (
    <div className="phone"><div className="phone-screen">
      <div className="statusbar"><span>9:41</span><span className="dots"><Icon name="signal" size={13} /><Icon name="wifi" size={13} /><Icon name="battery-full" size={15} /></span></div>
      {children}
    </div></div>
  );
}

function App() {
  const [view, setView] = useState("collaborator");
  const [saved, setSaved] = useState([]);     // ids
  const [savedItems, setSavedItems] = useState([]);
  const [sheet, setSheet] = useState(false);
  const [source, setSource] = useState(false);

  const onSave = (id, title) => {
    if (saved.includes(id)) return;
    setSaved((s) => [...s, id]);
    setSavedItems((s) => [...s, { id, title }]);
  };

  const TABS = [
    ["collaborator", "smartphone", "Colaborador · móvil"],
    ["access", "log-in", "Acceso"],
    ["onboarding", "sparkles", "Onboarding"],
    ["admin", "monitor", "Admin · escritorio"],
  ];

  return (
    <div className="app-stage">
      <div className="switcher">
        {TABS.map(([k, ic, label]) => (
          <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}><Icon name={ic} size={15} />{label}</button>
        ))}
      </div>

      {view === "collaborator" && (
        <PhoneFrame>
          <ConsultScreen saved={saved} onSave={onSave} onOpenSheet={() => setSheet(true)} onOpenSource={() => setSource(true)} />
          {sheet && <SavedSheet items={savedItems} onClose={() => setSheet(false)} />}
          {source && <SourceOverlay onClose={() => setSource(false)} />}
        </PhoneFrame>
      )}
      {view === "access" && <AccessView />}
      {view === "onboarding" && <OnboardingView />}
      {view === "admin" && <AdminDashboard />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

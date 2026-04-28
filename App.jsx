import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Camera, Plus, Search, Bell, DollarSign, Package, CheckCircle2,
  Clock, User, Home, BarChart3, ClipboardList, Trash2, LogOut
} from "lucide-react";
import "./style.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card stat">
      <div className="icon"><Icon size={20} /></div>
      <div>
        <p className="muted small">{label}</p>
        <p className="big"><b>{value}</b></p>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    ["home", Home, "Inicio"],
    ["products", Package, "Productos"],
    ["orders", ClipboardList, "Pedidos"],
    ["money", BarChart3, "Ganancias"],
    ["alerts", Bell, "Alertas"],
  ];
  return (
    <div className="bottom-nav">
      {items.map(([key, Icon, label]) => (
        <button key={key} onClick={() => setTab(key)} className={tab === key ? "active" : ""}>
          <Icon size={17} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    const res = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (res.error) setMsg(res.error.message);
    else setMsg(mode === "login" ? "Entrando..." : "Cuenta creada. Ahora inicia sesión.");
  };

  return (
    <div className="app-shell">
      <div className="phone login-screen">
        <div className="card form login-card">
          <h1>EMG Orders Pro</h1>
          <p className="muted">Acceso privado para administrar productos, pedidos y depósitos.</p>
          <input placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="primary" onClick={submit}>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
          <button className="ghost-link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
          </button>
          {msg && <p className="muted">{msg}</p>}
        </div>
      </div>
    </div>
  );
}

function ProductImage({ src }) {
  if (!src) return <div className="placeholder"><Package size={32} /></div>;
  return <img src={src} className="product-img" alt="Producto" />;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("home");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [newProduct, setNewProduct] = useState({ nombre: "", tienda: "Ross", precio_compra: "", precio_venta: "", foto: "" });
  const [newOrder, setNewOrder] = useState({ cliente: "", producto_id: "", total: "", deposito: "", entrega_fecha: todayISO() });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadAll();
      loadProfile();
    }
  }, [session]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data);
  };

  const loadAll = async () => {
    const { data: productData } = await supabase.from("productos").select("*").order("id", { ascending: false });
    const { data: orderData } = await supabase.from("pedidos").select("*").order("id", { ascending: false });
    setProducts(productData || []);
    setOrders(orderData || []);
  };

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const deposits = orders.reduce((s, o) => s + Number(o.deposito || 0), 0);
    const pending = revenue - deposits;
    const profit = orders.reduce((s, o) => {
      const p = products.find((x) => Number(x.id) === Number(o.producto_id));
      return s + (Number(o.total || 0) - Number(p?.precio_compra || 0));
    }, 0);
    return { revenue, deposits, pending, profit };
  }, [orders, products]);

  const handlePhotoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewProduct({ ...newProduct, foto: reader.result });
    reader.readAsDataURL(file);
  };

  const addProduct = async () => {
    if (!newProduct.nombre || !newProduct.precio_venta) return alert("Agrega nombre y precio de venta.");
    const { error } = await supabase.from("productos").insert({
      nombre: newProduct.nombre,
      tienda: newProduct.tienda,
      precio_compra: Number(newProduct.precio_compra || 0),
      precio_venta: Number(newProduct.precio_venta || 0),
      foto: newProduct.foto,
      stock: 1,
    });
    if (error) return alert(error.message);
    setNewProduct({ nombre: "", tienda: "Ross", precio_compra: "", precio_venta: "", foto: "" });
    loadAll();
  };

  const deleteProduct = async (id) => {
    if (profile?.role !== "admin") return alert("Solo admin puede borrar productos.");
    const { error } = await supabase.from("productos").delete().eq("id", id);
    if (error) return alert(error.message);
    loadAll();
  };

  const addOrder = async () => {
    if (!newOrder.producto_id || !newOrder.total) return alert("Agrega producto y total.");
    const total = Number(newOrder.total || 0);
    const deposito = Number(newOrder.deposito || 0);
    const { error } = await supabase.from("pedidos").insert({
      producto_id: Number(newOrder.producto_id),
      total,
      deposito,
      saldo: total - deposito,
      estado: deposito >= total ? "pagado" : deposito > 0 ? "apartado" : "pendiente",
      entrega_fecha: newOrder.entrega_fecha,
    });
    if (error) return alert(error.message);
    setNewOrder({ cliente: "", producto_id: "", total: "", deposito: "", entrega_fecha: todayISO() });
    loadAll();
  };

  const filteredProducts = products.filter((p) =>
    (p.nombre || "").toLowerCase().includes(query.toLowerCase()) ||
    (p.tienda || "").toLowerCase().includes(query.toLowerCase())
  );

  if (!session) return <LoginScreen />;

  return (
    <div className="app-shell">
      <div className="phone">
        <header>
          <div>
            <p className="muted small">EMG Orders Pro · {profile?.role || "staff"}</p>
            <h1>Pedidos de Reventa</h1>
          </div>
          <button className="circle" onClick={() => supabase.auth.signOut()}><LogOut size={20} /></button>
        </header>

        <main>
          {tab === "home" && (
            <div className="stack">
              <div className="grid2">
                <StatCard icon={DollarSign} label="Ventas" value={money(stats.revenue)} />
                <StatCard icon={CheckCircle2} label="Depósitos" value={money(stats.deposits)} />
                <StatCard icon={Clock} label="Por cobrar" value={money(stats.pending)} />
                <StatCard icon={BarChart3} label="Ganancia aprox." value={money(stats.profit)} />
              </div>
              <section className="dark-card">
                <h2>Entregas de hoy</h2>
                <p>Lista rápida para no olvidar productos ni pagos.</p>
                {orders.filter((o) => o.entrega_fecha === todayISO()).length === 0 && <p>No hay entregas para hoy.</p>}
                {orders.filter((o) => o.entrega_fecha === todayISO()).map((o) => {
                  const p = products.find((x) => Number(x.id) === Number(o.producto_id));
                  return <div key={o.id} className="dark-item"><b>Pedido #{o.id}</b><span>{p?.nombre || "Producto"}</span><span>Debe: {money(o.saldo)}</span></div>;
                })}
              </section>
            </div>
          )}

          {tab === "products" && (
            <div className="stack">
              <div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o tienda" /></div>
              <div className="card form">
                <h2><Plus size={20} /> Agregar producto</h2>
                {newProduct.foto && <img src={newProduct.foto} className="preview" alt="Vista previa" />}
                <input placeholder="Nombre del producto" value={newProduct.nombre} onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })} />
                <label className="upload"><Camera size={18} /> Subir foto desde celular<input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} /></label>
                <div className="grid3">
                  <select value={newProduct.tienda} onChange={(e) => setNewProduct({ ...newProduct, tienda: e.target.value })}><option>Ross</option><option>Burlington</option><option>Marshalls</option><option>TJ Maxx</option><option>Otra</option></select>
                  <input type="number" placeholder="Costo" value={newProduct.precio_compra} onChange={(e) => setNewProduct({ ...newProduct, precio_compra: e.target.value })} />
                  <input type="number" placeholder="Venta" value={newProduct.precio_venta} onChange={(e) => setNewProduct({ ...newProduct, precio_venta: e.target.value })} />
                </div>
                <button className="primary" onClick={addProduct}>Guardar producto</button>
              </div>
              {filteredProducts.map((p) => (
                <div key={p.id} className="card row">
                  <ProductImage src={p.foto} />
                  <div className="fill">
                    <div className="between"><b>{p.nombre}</b>{profile?.role === "admin" && <button className="ghost" onClick={() => deleteProduct(p.id)}><Trash2 size={16} /></button>}</div>
                    <p className="muted">{p.tienda || "Tienda"} · Stock {p.stock || 0}</p>
                    <p>Costo: {money(p.precio_compra)}</p>
                    <b>Venta: {money(p.precio_venta)}</b>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div className="stack">
              <div className="card form">
                <h2><User size={20} /> Nuevo pedido</h2>
                <select value={newOrder.producto_id} onChange={(e) => {
                  const p = products.find((x) => Number(x.id) === Number(e.target.value));
                  setNewOrder({ ...newOrder, producto_id: e.target.value, total: p?.precio_venta || "" });
                }}>
                  <option value="">Selecciona producto</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {money(p.precio_venta)}</option>)}
                </select>
                <div className="grid3">
                  <input type="number" placeholder="Total" value={newOrder.total} onChange={(e) => setNewOrder({ ...newOrder, total: e.target.value })} />
                  <input type="number" placeholder="Depósito" value={newOrder.deposito} onChange={(e) => setNewOrder({ ...newOrder, deposito: e.target.value })} />
                  <input type="date" value={newOrder.entrega_fecha} onChange={(e) => setNewOrder({ ...newOrder, entrega_fecha: e.target.value })} />
                </div>
                <button className="primary" onClick={addOrder}>Guardar pedido</button>
              </div>
              {orders.map((o) => {
                const p = products.find((x) => Number(x.id) === Number(o.producto_id));
                return <div key={o.id} className="card"><b>Pedido #{o.id}</b><p className="muted">{p?.nombre || "Producto"}</p><span className="pill">{o.estado}</span><div className="grid3 mini"><p>Total<br /><b>{money(o.total)}</b></p><p>Depósito<br /><b>{money(o.deposito)}</b></p><p>Debe<br /><b>{money(o.saldo)}</b></p></div></div>;
              })}
            </div>
          )}

          {tab === "money" && (
            <div className="stack">
              <StatCard icon={DollarSign} label="Ventas totales" value={money(stats.revenue)} />
              <StatCard icon={CheckCircle2} label="Dinero recibido" value={money(stats.deposits)} />
              <StatCard icon={Clock} label="Dinero pendiente" value={money(stats.pending)} />
              <StatCard icon={BarChart3} label="Ganancia estimada" value={money(stats.profit)} />
            </div>
          )}

          {tab === "alerts" && (
            <div className="stack">
              <div className="card row"><Bell size={20} /><div><b>Sesión activa</b><p className="muted">{session.user.email}</p></div></div>
              {orders.filter((o) => Number(o.saldo) > 0).map((o) => <div key={o.id} className="card row"><Bell size={20} /><div><b>Cobro pendiente</b><p className="muted">Pedido #{o.id} debe {money(o.saldo)}</p></div></div>)}
            </div>
          )}
        </main>

        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

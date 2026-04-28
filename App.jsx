import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import { Camera, Plus, Search, Bell, DollarSign, Package, Truck, CheckCircle2, Clock, User, Home, BarChart3, ClipboardList, Trash2, Download } from "lucide-react";
import "./style.css";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

const sampleProducts = [
  { id: 1, name: "Bolsa Calvin Klein negra", store: "Ross", photo: "", cost: 29.99, sale: 48, status: "Disponible", createdAt: todayISO() },
  { id: 2, name: "Tenis Nike mujer", store: "Burlington", photo: "", cost: 39.99, sale: 65, status: "Disponible", createdAt: todayISO() },
];

const sampleOrders = [
  { id: 101, client: "María López", contact: "Facebook", productId: 2, product: "Tenis Nike mujer", total: 65, deposit: 20, deliveryDate: todayISO(), status: "Por entregar", createdAt: todayISO() },
];

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

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
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ProductImage({ src }) {
  if (!src) return <div className="placeholder"><Package size={32} /></div>;
  return <img src={src} className="product-img" alt="Producto" />;
}

function App() {
  const [tab, setTab] = useState("home");
  const [products, setProducts] = useLocalStorage("resale_products_v1", sampleProducts);
  const [orders, setOrders] = useLocalStorage("resale_orders_v1", sampleOrders);
  const [query, setQuery] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", store: "Ross", cost: "", sale: "", photo: "" });
  const [newOrder, setNewOrder] = useState({ client: "", contact: "Facebook", productId: "", total: "", deposit: "", deliveryDate: todayISO() });

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const deposits = orders.reduce((s, o) => s + Number(o.deposit), 0);
    const pending = revenue - deposits;
    const profit = orders.reduce((s, o) => {
      const product = products.find((p) => Number(p.id) === Number(o.productId));
      return s + (Number(o.total) - Number(product?.cost || 0));
    }, 0);
    return { revenue, deposits, pending, profit };
  }, [orders, products]);

  const alerts = useMemo(() => {
    const list = [];
    orders.forEach((o) => {
      const due = Number(o.total) - Number(o.deposit);
      if (due > 0) list.push({ id: `pay-${o.id}`, title: "Cobro pendiente", text: `${o.client} debe ${money(due)} por ${o.product}.` });
      if (o.deliveryDate === todayISO() && o.status !== "Entregado") list.push({ id: `del-${o.id}`, title: "Entrega de hoy", text: `${o.client} tiene entrega hoy: ${o.product}.` });
    });
    products.filter(p => p.status === "Apartado").forEach(p => list.push({ id: `prod-${p.id}`, title: "Producto apartado", text: `${p.name} está apartado. No lo vendas doble.` }));
    return list;
  }, [orders, products]);

  const addProduct = () => {
    if (!newProduct.name || !newProduct.sale) return alert("Agrega nombre y precio de venta.");
    setProducts([{ id: Date.now(), ...newProduct, cost: Number(newProduct.cost || 0), sale: Number(newProduct.sale || 0), status: "Disponible", createdAt: todayISO() }, ...products]);
    setNewProduct({ name: "", store: "Ross", cost: "", sale: "", photo: "" });
  };

  const addOrder = () => {
    if (!newOrder.client || !newOrder.productId || !newOrder.total) return alert("Agrega cliente, producto y total.");
    const product = products.find(p => Number(p.id) === Number(newOrder.productId));
    const deposit = Number(newOrder.deposit || 0);
    const total = Number(newOrder.total || 0);
    const status = deposit >= total ? "Pagado" : deposit > 0 ? "Apartado" : "Esperando depósito";
    setOrders([{ id: Date.now(), ...newOrder, product: product?.name || "Producto", total, deposit, status, createdAt: todayISO() }, ...orders]);
    setProducts(products.map(p => Number(p.id) === Number(newOrder.productId) ? { ...p, status: "Apartado" } : p));
    setNewOrder({ client: "", contact: "Facebook", productId: "", total: "", deposit: "", deliveryDate: todayISO() });
  };

  const markDelivered = (id) => {
    const order = orders.find(o => o.id === id);
    setOrders(orders.map(o => o.id === id ? { ...o, status: "Entregado", deposit: Number(o.total) } : o));
    if (order) setProducts(products.map(p => Number(p.id) === Number(order.productId) ? { ...p, status: "Vendido" } : p));
  };

  const handlePhotoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewProduct({ ...newProduct, photo: reader.result });
    reader.readAsDataURL(file);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ products, orders }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pedidos-reventa-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.store.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <div className="phone">
        <header>
          <div>
            <p className="muted small">PWA lista para celular</p>
            <h1>Pedidos de Reventa</h1>
          </div>
          <button className="circle" onClick={exportData}><Download size={20} /></button>
        </header>

        <main>
          {tab === "home" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stack">
              <div className="grid2">
                <StatCard icon={DollarSign} label="Ventas" value={money(stats.revenue)} />
                <StatCard icon={CheckCircle2} label="Depósitos" value={money(stats.deposits)} />
                <StatCard icon={Clock} label="Por cobrar" value={money(stats.pending)} />
                <StatCard icon={BarChart3} label="Ganancia aprox." value={money(stats.profit)} />
              </div>
              <section className="dark-card">
                <h2>Entregas de hoy</h2>
                <p>Lista rápida para no olvidar productos ni pagos.</p>
                {orders.filter(o => o.deliveryDate === todayISO() && o.status !== "Entregado").length === 0 && <p>No hay entregas para hoy.</p>}
                {orders.filter(o => o.deliveryDate === todayISO() && o.status !== "Entregado").map(o => (
                  <div key={o.id} className="dark-item">
                    <b>{o.client}</b>
                    <span>{o.product}</span>
                    <span>Debe: {money(o.total - o.deposit)}</span>
                    <button onClick={() => markDelivered(o.id)}>Marcar entregado</button>
                  </div>
                ))}
              </section>
            </motion.div>
          )}

          {tab === "products" && (
            <div className="stack">
              <div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o tienda" /></div>

              <div className="card form">
                <h2><Plus size={20} /> Agregar producto</h2>
                {newProduct.photo && <img src={newProduct.photo} className="preview" alt="Vista previa" />}
                <input placeholder="Nombre del producto" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                <label className="upload"><Camera size={18} /> Subir foto desde celular<input type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e.target.files?.[0])} /></label>
                <div className="grid3">
                  <select value={newProduct.store} onChange={e => setNewProduct({...newProduct, store: e.target.value})}><option>Ross</option><option>Burlington</option><option>Marshalls</option><option>TJ Maxx</option><option>Otra</option></select>
                  <input type="number" placeholder="Costo" value={newProduct.cost} onChange={e => setNewProduct({...newProduct, cost: e.target.value})} />
                  <input type="number" placeholder="Venta" value={newProduct.sale} onChange={e => setNewProduct({...newProduct, sale: e.target.value})} />
                </div>
                <button className="primary" onClick={addProduct}>Guardar producto</button>
              </div>

              {filteredProducts.map(p => (
                <div key={p.id} className="card row">
                  <ProductImage src={p.photo} />
                  <div className="fill">
                    <div className="between"><b>{p.name}</b><button className="ghost" onClick={() => setProducts(products.filter(x => x.id !== p.id))}><Trash2 size={16} /></button></div>
                    <p className="muted">{p.store} · {p.status}</p>
                    <p>Costo: {money(p.cost)}</p>
                    <b>Venta: {money(p.sale)}</b>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div className="stack">
              <div className="card form">
                <h2><User size={20} /> Nuevo pedido</h2>
                <input placeholder="Nombre del cliente" value={newOrder.client} onChange={e => setNewOrder({...newOrder, client: e.target.value})} />
                <select value={newOrder.productId} onChange={e => {
                  const prod = products.find(p => Number(p.id) === Number(e.target.value));
                  setNewOrder({...newOrder, productId: e.target.value, total: prod?.sale || ""});
                }}>
                  <option value="">Selecciona producto</option>
                  {products.filter(p => p.status !== "Vendido").map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.sale)}</option>)}
                </select>
                <div className="grid3">
                  <input type="number" placeholder="Total" value={newOrder.total} onChange={e => setNewOrder({...newOrder, total: e.target.value})} />
                  <input type="number" placeholder="Depósito" value={newOrder.deposit} onChange={e => setNewOrder({...newOrder, deposit: e.target.value})} />
                  <input type="date" value={newOrder.deliveryDate} onChange={e => setNewOrder({...newOrder, deliveryDate: e.target.value})} />
                </div>
                <button className="primary" onClick={addOrder}>Guardar pedido</button>
              </div>

              {orders.map(o => (
                <div key={o.id} className="card">
                  <div className="between">
                    <div><b>{o.client}</b><p className="muted">{o.product}</p></div>
                    <button className="ghost" onClick={() => setOrders(orders.filter(x => x.id !== o.id))}><Trash2 size={16} /></button>
                  </div>
                  <span className="pill">{o.status}</span>
                  <div className="grid3 mini">
                    <p>Total<br/><b>{money(o.total)}</b></p>
                    <p>Depósito<br/><b>{money(o.deposit)}</b></p>
                    <p>Debe<br/><b>{money(o.total - o.deposit)}</b></p>
                  </div>
                  {o.status !== "Entregado" && <button className="primary smallbtn" onClick={() => markDelivered(o.id)}>Marcar pagado y entregado</button>}
                </div>
              ))}
            </div>
          )}

          {tab === "money" && (
            <div className="stack">
              <StatCard icon={DollarSign} label="Ventas totales" value={money(stats.revenue)} />
              <StatCard icon={CheckCircle2} label="Dinero recibido" value={money(stats.deposits)} />
              <StatCard icon={Clock} label="Dinero pendiente" value={money(stats.pending)} />
              <StatCard icon={BarChart3} label="Ganancia estimada" value={money(stats.profit)} />
              <div className="card"><h2>Resumen inteligente</h2><p className="muted">Antes de entregar, cobra {money(stats.pending)} pendiente. Usa el botón de descarga arriba para guardar una copia de seguridad.</p></div>
            </div>
          )}

          {tab === "alerts" && (
            <div className="stack">
              {alerts.length === 0 && <div className="card">No hay alertas por ahora.</div>}
              {alerts.map(a => <div key={a.id} className="card row"><Bell size={20} /><div><b>{a.title}</b><p className="muted">{a.text}</p></div></div>)}
            </div>
          )}
        </main>

        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

createRoot(document.getElementById("root")).render(<App />);

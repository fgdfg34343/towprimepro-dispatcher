import { useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import HowItWorks from './components/HowItWorks';
import Advantages from './components/Advantages';
import TruckTypes from './components/TruckTypes';
import FAQ from './components/FAQ';
import Contacts from './components/Contacts';
import Footer from './components/Footer';
import BookingModal from './components/BookingModal';
import OrderStatusToast from './components/OrderStatusToast';
import PrivacyPolicy from './components/PrivacyPolicy';
import Oferta from './components/Oferta';
import { readTrackedOrderId, storeTrackedOrderId } from './lib/orderTracking';

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [trackedOrderId, setTrackedOrderId] = useState(() => readTrackedOrderId());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showOferta, setShowOferta] = useState(false);

  const openOrder = (data = {}) => {
    setOrderData(data);
    setModalOpen(true);
  };

  const handleTrackOrder = (orderId) => {
    setTrackedOrderId(orderId);
    storeTrackedOrderId(orderId);
  };

  const clearTrackedOrder = () => {
    setTrackedOrderId(null);
    storeTrackedOrderId(null);
  };

  return (
    <div className="min-h-screen">
      <Header onOrderClick={() => openOrder({})}/>
      <HeroSection onOrderClick={openOrder}/>
      <HowItWorks/>
      <Advantages onOrderClick={() => openOrder({})}/>
      <TruckTypes onOrderClick={() => openOrder({})}/>
      <FAQ/>
      <Contacts onOrderClick={() => openOrder({})}/>
      <Footer onPrivacyClick={() => setShowPrivacy(true)} onOfertaClick={() => setShowOferta(true)}/>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)}/>}
      {showOferta && <Oferta onClose={() => setShowOferta(false)}/>}

      {modalOpen && (
        <BookingModal
          orderData={orderData}
          onTrackOrder={handleTrackOrder}
          onClose={() => setModalOpen(false)}
        />
      )}

      <OrderStatusToast
        orderId={trackedOrderId}
        onClear={clearTrackedOrder}
      />
    </div>
  );
}

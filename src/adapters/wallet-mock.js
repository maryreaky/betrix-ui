// src/adapters/wallet-mock.js
module.exports = {
  async reserve(userId, amount, idempotencyKey){
    // reserve simulation: returns reserveId
    return { reserveId: `r_${Date.now()}_${Math.floor(Math.random()*1000)}`, status: 'reserved' };
  },
  async release(reserveId){
    return { status: 'released' };
  },
  async confirm(reserveId){
    return { txId: `tx_${Date.now()}_${Math.floor(Math.random()*1000)}`, status: 'confirmed' };
  },
  async balance(userId){
    return { available: 1000000, reserved: 0 };
  }
};

module.exports = {
  async createSubscription(userId, tier) {
    const id = sub__;
    return { subscriptionId: id, tier, expiresAt: new Date(Date.now()+30*24*3600*1000).toISOString() };
  },
  async getSubscription(userId) {
    return null;
  }
};

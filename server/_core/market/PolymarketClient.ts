import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { config } from '../../config/config';
import { Logger } from '../logger/Logger';
import { PolymarketMarket, PolymarketOrder, PolymarketOutcome } from './types';

export class PolymarketClient {
  private clobClient: ClobClient;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PolymarketClient');
    if (!config.polymarketApiKey || !config.polymarketSecret || !config.polymarketPassphrase) {
      this.logger.error('Polymarket API keys are not configured. Cannot initialize ClobClient.');
      throw new Error('Polymarket API keys missing.');
    }
    this.clobClient = new ClobClient({
      key: config.polymarketApiKey,
      secret: config.polymarketSecret,
      passphrase: config.polymarketPassphrase,
      env: config.polymarketEnv === 'production' ? 'production' : 'staging',
    });
    this.logger.info('Polymarket ClobClient initialized.');
  }

  async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    try {
      const market = await this.clobClient.getMarketBySlug(slug);
      if (!market) return null;

      return {
        id: market.id,
        question: market.question,
        slug: market.slug,
        state: market.state as PolymarketMarket['state'],
        outcomeType: market.outcomeType as PolymarketMarket['outcomeType'],
        outcomes: market.outcomes.map(o => ({
          id: o.id,
          title: o.title,
          price: o.price,
          probability: o.probability,
        })),
        endTime: market.endTime,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch market by slug ${slug}:`, error);
      return null;
    }
  }

  async getMarketById(marketId: string): Promise<PolymarketMarket | null> {
    try {
      const market = await this.clobClient.getMarketById(marketId);
      if (!market) return null;

      return {
        id: market.id,
        question: market.question,
        slug: market.slug,
        state: market.state as PolymarketMarket['state'],
        outcomeType: market.outcomeType as PolymarketMarket['outcomeType'],
        outcomes: market.outcomes.map(o => ({
          id: o.id,
          title: o.title,
          price: o.price,
          probability: o.probability,
        })),
        endTime: market.endTime,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch market by ID ${marketId}:`, error);
      return null;
    }
  }

  async placeOrder(order: PolymarketOrder): Promise<string | null> {
    try {
      this.logger.info('Placing Polymarket order', order);
      const clobOrder = await this.clobClient.createOrder({
        marketId: order.marketId,
        outcomeId: order.outcomeId,
        side: order.side === 'buy' ? Side.BUY : Side.SELL,
        price: order.price,
        size: order.size,
        orderType: order.orderType === 'limit' ? OrderType.LIMIT : OrderType.MARKET,
        // Assuming default timeInForce, postOnly, etc. For more control, add to PolymarketOrder interface
      });
      this.logger.info('Polymarket order placed successfully', { orderId: clobOrder.id });
      return clobOrder.id;
    } catch (error) {
      this.logger.error('Failed to place Polymarket order:', error);
      return null;
    }
  }

  async getOutcomePrice(marketId: string, outcomeId: string): Promise<PolymarketOutcome | null> {
    try {
      const market = await this.clobClient.getMarketById(marketId);
      if (!market) return null;
      const outcome = market.outcomes.find(o => o.id === outcomeId);
      if (!outcome) return null;

      return {
        marketId,
        outcomeId,
        price: outcome.price,
        probability: outcome.probability,
      };
    } catch (error) {
      this.logger.error(`Failed to get outcome price for market ${marketId}, outcome ${outcomeId}:`, error);
      return null;
    }
  }
}

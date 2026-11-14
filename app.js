'use strict';

const MARKET_API_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&x_cg_demo_api_key=CG-wgb2jwQBYcwfQPAuh6oMLrG5';
const DISPLAY_LIMIT = 20;
const resultsContainer = document.querySelector('#market-results');
const refreshButton = document.querySelector('#refresh-button');
const updatedLabel = document.querySelector('#last-updated');
const searchInput = document.querySelector('#coin-search');
const clearSearchButton = document.querySelector('#clear-search');
const sectionCaption = document.querySelector('#section-caption');
let marketCoins = [];
let searchDebounceTimer;
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2
});

function formatPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const digits = Number(value) >= 1 ? 2 : 6;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits
  }).format(Number(value));
}

function formatMarketCap(value) {
  return Number.isFinite(Number(value)) ? compactMoneyFormatter.format(Number(value)) : '—';
}

function formatChange(value) {
  return Number.isFinite(Number(value)) ? `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}%` : '—';
}

function createSkeletonRows() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < DISPLAY_LIMIT; index += 1) {
    const row = document.createElement('div');
    row.className = 'market-table market-row skeleton-row';
    row.setAttribute('aria-hidden', 'true');
    row.innerHTML = '<span class="col-asset skeleton-asset"><i></i><b></b><b></b></span><span class="col-price align-right"><i></i></span><span class="col-change align-right"><i></i></span><span class="col-cap align-right"><i></i></span>';
    fragment.append(row);
  }
  return fragment;
}

function renderCoins(coins, limit = DISPLAY_LIMIT) {
  const fragment = document.createDocumentFragment();
  coins.slice(0, limit).forEach((coin, index) => {
    const row = document.createElement('article');
    const change = Number(coin.price_change_percentage_24h);
    const changeClass = Number.isFinite(change) && change < 0 ? 'change-negative' : 'change-positive';
    row.className = 'market-table market-row';

    const asset = document.createElement('div');
    asset.className = 'asset-cell col-asset';
    const rank = document.createElement('span');
    rank.className = 'asset-rank';
    rank.textContent = String(coin.market_cap_rank ?? index + 1).padStart(2, '0');
    const image = document.createElement('img');
    image.className = 'coin-image';
    image.src = coin.image || '';
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    const nameWrap = document.createElement('span');
    nameWrap.className = 'asset-name-wrap';
    const name = document.createElement('strong');
    name.className = 'asset-name';
    name.textContent = coin.name || 'Unknown coin';
    const symbol = document.createElement('span');
    symbol.className = 'asset-symbol';
    symbol.textContent = coin.symbol ? coin.symbol.toUpperCase() : '';
    nameWrap.append(name, symbol);
    asset.append(rank, image, nameWrap);

    const price = document.createElement('span');
    price.className = 'col-price align-right numeric-cell';
    price.textContent = formatPrice(coin.current_price);
    const changeCell = document.createElement('span');
    changeCell.className = `col-change align-right change-cell ${changeClass}`;
    changeCell.textContent = formatChange(change);
    const cap = document.createElement('span');
    cap.className = 'col-cap align-right numeric-cell';
    cap.textContent = formatMarketCap(coin.market_cap);
    row.append(asset, price, changeCell, cap);
    fragment.append(row);
  });
  resultsContainer.replaceChildren(fragment);
  resultsContainer.setAttribute('aria-busy', 'false');
}

// FEATURE 2: Search — filter the fetched CoinGecko coins by name or symbol.
function showNoSearchResults(query) {
  const panel = document.createElement('div');
  panel.className = 'state-panel';
  const title = document.createElement('h3');
  title.textContent = 'No results found';
  const message = document.createElement('p');
  message.textContent = `No coin matched “${query}”. Try another name or ticker symbol.`;
  panel.append(title, message);
  resultsContainer.replaceChildren(panel);
  resultsContainer.setAttribute('aria-busy', 'false');
}

function applyCoinSearch() {
  if (marketCoins.length === 0) return;
  const query = searchInput.value.trim().toLocaleLowerCase();
  clearSearchButton.hidden = query.length === 0;

  if (!query) {
    sectionCaption.textContent = 'The 20 largest coins by market capitalization';
    renderCoins(marketCoins);
    return;
  }

  const matchingCoins = marketCoins.filter((coin) => {
    const name = (coin.name || '').toLocaleLowerCase();
    const symbol = (coin.symbol || '').toLocaleLowerCase();
    return name.includes(query) || symbol.includes(query);
  });

  sectionCaption.textContent = `${matchingCoins.length} matching ${matchingCoins.length === 1 ? 'coin' : 'coins'} in the first ${marketCoins.length} market results`;
  if (matchingCoins.length === 0) {
    showNoSearchResults(searchInput.value.trim());
    return;
  }
  renderCoins(matchingCoins, matchingCoins.length);
}

function handleSearchInput() {
  window.clearTimeout(searchDebounceTimer);
  searchDebounceTimer = window.setTimeout(applyCoinSearch, 250);
}
function showEmptyState() {
  const panel = document.createElement('div');
  panel.className = 'state-panel';
  const title = document.createElement('h3');
  title.textContent = 'No coins available';
  const message = document.createElement('p');
  message.textContent = 'CoinGecko returned no market results. Refresh to try again.';
  panel.append(title, message);
  resultsContainer.replaceChildren(panel);
  resultsContainer.setAttribute('aria-busy', 'false');
}

function showErrorState() {
  const panel = document.createElement('div');
  panel.className = 'state-panel state-error';
  const title = document.createElement('h3');
  title.textContent = 'Market data could not load';
  const message = document.createElement('p');
  message.textContent = 'Check your connection and try refreshing the market data.';
  const retry = document.createElement('button');
  retry.className = 'retry-button';
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', loadMarketData);
  panel.append(title, message, retry);
  resultsContainer.replaceChildren(panel);
  resultsContainer.setAttribute('aria-busy', 'false');
}

async function loadMarketData() {
  refreshButton.disabled = true;
  refreshButton.classList.add('is-refreshing');
  resultsContainer.replaceChildren(createSkeletonRows());
  resultsContainer.setAttribute('aria-busy', 'true');
  updatedLabel.textContent = 'Updating market data…';

  try {
    const response = await fetch(MARKET_API_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Market request failed with status ${response.status}`);
    const coins = await response.json();
    if (!Array.isArray(coins) || coins.length === 0) {
      showEmptyState();
      updatedLabel.textContent = 'No market data returned';
      return;
    }
    marketCoins = coins;
    applyCoinSearch();
    updatedLabel.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())} · Showing the top ${Math.min(coins.length, DISPLAY_LIMIT)} coins`;
  } catch (error) {
    console.error('Unable to load CoinGecko market data:', error);
    showErrorState();
    updatedLabel.textContent = 'Market data unavailable';
  } finally {
    refreshButton.disabled = false;
    refreshButton.classList.remove('is-refreshing');
  }
}

// FEATURE 2: Debounce typing so the local list updates after the user pauses.
searchInput.addEventListener('input', handleSearchInput);
clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  window.clearTimeout(searchDebounceTimer);
  applyCoinSearch();
  searchInput.focus();
});

refreshButton.addEventListener('click', loadMarketData);
loadMarketData();



const DO_NOTHING = {
  title: "Do nothing",
  id: "do_nothing"
}

const MERGE_AND_SORT_ACTION = {
  title: "Merge windows and sort tabs",
  id: "merge_and_sort"
}

const MERGE_ACTION = {
  title: "Merge windows",
  id: "merge"
}

const SORT_ACTION = {
  title: "Sort tabs",
  id: "sort"
}

const CLOSE_TABS_FROM_THIS_DOMAIN_ACTION = {
  title: "Close tabs from this domain",
  id: "close_tabs_from_this_domain"
}

const MOVE_TABS_FROM_THIS_DOMAIN_ACTION = {
  title: "Move tabs from this domain to this window",
  id: "move_tabs_from_this_domain"
}

const MOVE_TABS_FROM_DEEP2_DOMAIN_ACTION = {
  title: "Move tabs from this level 2 domain to this window",
  id: "move_tabs_from_deep2_domain"
}

const GROUP_TABS_FROM_THIS_DOMAON_ACTION = {
  title: "Group tabs from this domain",
  id: "group_tabs_from_this_domain"
}


const ALL_ACTIONS = [
  DO_NOTHING, MERGE_ACTION, SORT_ACTION, CLOSE_TABS_FROM_THIS_DOMAIN_ACTION, 
  MOVE_TABS_FROM_THIS_DOMAIN_ACTION, MOVE_TABS_FROM_DEEP2_DOMAIN_ACTION, GROUP_TABS_FROM_THIS_DOMAON_ACTION]
// MERGE_AND_SORT_ACTION,

async function getOptions() {
  return await chrome.storage.sync.get({
//    defaultAction: MERGE_AND_SORT_ACTION.id,
    defaultAction: DO_NOTHING.id,
    ignorePinnedTabs: true,
    ignorePopupWindows: true,
    ignoreAppWindows: true,
    showDefaultActionPopup: true,
  })
}

async function getTabsFromDomain(url) {
  let options = await getOptions()
  let tabs = await chrome.tabs.query({
    groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
    url: url.protocol + "//" + url.host + "/*",
    pinned: options.ignorePinnedTabs ? false : undefined,
  })
  return tabs
}

async function getTabsFromDeep2Domain(url) {
  // 获取选项配置
  let options = await getOptions();
  
  // 提取二级域名
  let hostnameParts = url.hostname.split(".");
  let domain = hostnameParts.slice(-2).join(".");
  
  // 构建查询条件
  let queryUrl = url.protocol + "//*." + domain + "/*";
  
  // 查询标签页
  let tabs = await chrome.tabs.query({
    groupId: chrome.tabGroups.TAB_GROUP_ID_NONE,
    url: queryUrl,
    pinned: options.ignorePinnedTabs ? false : undefined
  });
  
  return tabs;
}

function baseAction(actionId) {
  if (actionId == DO_NOTHING.id) {
    //DO NOTHING
  } else if (actionId == MERGE_AND_SORT_ACTION.id) {
    mergeWindowsAndSortTabsAction()
  } else if (actionId == MERGE_ACTION.id) {
    mergeWindowsAction()
  } else if (actionId == SORT_ACTION.id) {
    sortTabsAction()
  } else if (actionId == CLOSE_TABS_FROM_THIS_DOMAIN_ACTION.id) {
    closeTabsFromCurrentDomainAction()
  } else if (actionId == MOVE_TABS_FROM_THIS_DOMAIN_ACTION.id) {
    moveTabsFromCurrentDomainAction()
  } else if (actionId == MOVE_TABS_FROM_DEEP2_DOMAIN_ACTION.id) {
    moveTabsFromCurrentDeep2DomainAction()
  } else if (actionId == GROUP_TABS_FROM_THIS_DOMAON_ACTION.id) {
    groupTabsFromCurrentDomainAction()
  }
}

async function mergeWindowsAndSortTabsAction() {
  await mergeWindows()
  await sortTabs()
}

async function mergeWindowsAction() {
  await mergeWindows()
}

async function sortTabsAction() {
  await sortTabs()
}

async function closeTabsFromCurrentDomainAction() {
  let selectedTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  let url = new URL(selectedTab.url)
  let tabs = await getTabsFromDomain(url)
  for (let tab of tabs) {
    await chrome.tabs.remove(tab.id)
  }
}

async function moveTabsFromCurrentDomainAction() {
  let selectedTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  let url = new URL(selectedTab.url)
  let tabs = await getTabsFromDomain(url)
  for (let tab of tabs) {
    await chrome.tabs.move(tab.id, { windowId: selectedTab.windowId, index: -1 })
    if (tab.pinned == true) {
      await chrome.tabs.update(tab.id, { pinned: true })
    }
  }
}

async function moveTabsFromCurrentDeep2DomainAction() {
  let selectedTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  let url = new URL(selectedTab.url)
  let tabs = await getTabsFromDeep2Domain(url)
  for (let tab of tabs) {
    await chrome.tabs.move(tab.id, { windowId: selectedTab.windowId, index: -1 })
    if (tab.pinned == true) {
      await chrome.tabs.update(tab.id, { pinned: true })
    }
  }
}

async function groupTabsFromCurrentDomainAction() {
  let selectedTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  let url = new URL(selectedTab.url)
  let tabs = await getTabsFromDomain(url)
  let tabIds = tabs.map(tab => tab.id)
  let existingGroups = await chrome.tabGroups.query({ title: url.host })
  if (existingGroups.length > 0) {
    let existingGroupId = existingGroups[0].id
    await chrome.tabs.group({ groupId: existingGroupId, tabIds: tabIds })
  } else {
    let groupId = await chrome.tabs.group({ tabIds: tabIds })
    await chrome.tabGroups.update(groupId, { title: url.host })
  }
}

async function mergeWindows() {
  let options = await getOptions()
  let currentWindow = await chrome.windows.getCurrent()
  let windows = await chrome.windows.getAll({ populate: true })

  for (let window of windows) {
    if (window.id === currentWindow.id) {
      continue;
    }
    if (options.ignoreAppWindows && window.type === "app") {
      continue;
    }
    if (options.ignorePopupWindows && window.type === "popup") {
      continue;
    }

    for (let tab of window.tabs) {
      if (options.ignorePinnedTabs && tab.pinned) {
        continue
      }

      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        await chrome.tabGroups.move(tab.groupId, { windowId: currentWindow.id, index: -1 })
      } else {
        await chrome.tabs.move(tab.id, { windowId: currentWindow.id, index: -1 })
      }

      if (tab.pinned == true) {
        await chrome.tabs.update(tab.id, { pinned: true })
      }
    }
  }
}

async function sortTabs() {
  let options = await getOptions()
  let currentWindow = await chrome.windows.getCurrent({ populate: true })
  let tabs = currentWindow.tabs
  if (options.ignorePinnedTabs) {
    tabs = tabs.filter(tab => !tab.pinned)
  }

  tabs.sort(function (a, b) {
    if (a.groupId < b.groupId) {
      return -1
    } else if (a.groupId > b.groupId) {
      return 1
    } else {
      if (a.url < b.url) {
        return -1
      } else if (a.url > b.url) {
        return 1
      } else {
        return 0
      }
    }
  })

  for (let tab of tabs) {
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await chrome.tabGroups.move(tab.groupId, { windowId: currentWindow.id, index: -1 })
    } else {
      await chrome.tabs.move(tab.id, { windowId: currentWindow.id, index: -1 })
    }

    if (tab.pinned == true) {
      await chrome.tabs.update(tab.id, { pinned: true })
    }
  }
}

chrome.contextMenus.onClicked.addListener(event => {
  baseAction(event.menuItemId)
});

chrome.action.onClicked.addListener(async event => {
  let options = await getOptions()
  baseAction(options.defaultAction)
})

chrome.runtime.onInstalled.addListener(() => {
  for (action of ALL_ACTIONS) {
    if (action === DO_NOTHING) {
      continue
    }
    chrome.contextMenus.create({
      "title": action.title,
      "id": action.id,
      contexts: ["action"],
    });
  }

  getOptions().then(options => {
    chrome.action.setPopup({ popup: options.showDefaultActionPopup ? "popup.html" : "" })
  })
})

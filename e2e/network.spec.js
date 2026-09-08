import { test, expect } from "@playwright/test";

test("saved search criteria and new-only pagination survive browser navigation", async ({page}) => {
  const requests=[];
  const pet = n => ({ id:`qa-new-${n}`, name:`New cat ${n}`, species:'Cat', breed:'Shorthair', shelter:'Fixture shelter', city:'Pasadena' });
  await page.route('**/api/saved-searches', async route => {
    if (route.request().method()==='GET') return route.fulfill({json:{searches:[{id:'qa-search',name:'Pasadena cats',filters:{species:'Cat',q:'Pasadena'}}]}});
    const body=route.request().postDataJSON(); requests.push(body);
    return route.fulfill({json:{pets:body.cursor ? [pet(25),pet(26)] : Array.from({length:24},(_,i)=>pet(i+1)), nextCursor:body.cursor ? null : 'fixture-next-page',onlyNew:body.onlyNew}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?network&user=adopter');
  await page.getByRole('button',{name:'Saved searches',exact:true}).click();
  await page.getByRole('button',{name:'New pets since saved'}).click();
  await expect(page.getByLabel('Name, breed, shelter, or city')).toHaveValue('Pasadena');
  await expect(page.getByRole('combobox',{name:'Species',exact:true})).toHaveValue('Cat');
  await expect(page.locator('.network-pet')).toHaveCount(24);
  await page.getByRole('button',{name:'Load more pets'}).click();
  await expect(page.locator('.network-pet')).toHaveCount(26);
  expect(requests).toEqual([{action:'check',id:'qa-search',onlyNew:true},{action:'check',id:'qa-search',onlyNew:true,cursor:'fixture-next-page'}]);
  await page.getByRole('button',{name:'Lost & found',exact:true}).click();
  await page.getByLabel('City or neighborhood',{exact:true}).first().fill('Seattle');
  await page.getByRole('button',{name:'Pet search',exact:true}).click();
  await expect(page.getByLabel('Name, breed, shelter, or city')).toHaveValue('Pasadena');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test("shelter CSV preview and review submission work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?import&user=shelter");
  await page.getByText("Import shelter pets from CSV", { exact: true }).click();
  await page.getByLabel("CSV file").setInputFiles({
    name: "pets.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("external_id,name,species\nqa-rabbit,Juniper,Rabbit\n"),
  });
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByText("1 valid pets · 0 errors")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import for review" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Import for review" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Import saved for review",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

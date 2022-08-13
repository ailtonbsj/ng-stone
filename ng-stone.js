#!/usr/bin/node

const fs = require("fs");
const tsp = require("typescript-parser");

const tsParser = new tsp.TypescriptParser();

const vals = {};

// Groups values by arg
let argLabel;
process.argv.map((arg) => {
  if (arg[0] === "-") {
    argLabel = arg;
    vals[argLabel] = [];
  } else if (argLabel) vals[argLabel].push(arg);
});

async function main() {
  for (const key of Object.keys(vals)) {
    if (key === "-m") {
      const args = vals[key];
      const val = args[0];
      let formal = args[1];
      if (val) {
        console.log("Creating new module...");
        if (!formal) formal = toFormalCase(val);
        if (!detectCase(val).kebab) {
          console.log("Name of module need to be kebab-case!");
          process.exit();
        }
        const pathName = val.split("-").join("");
        const className = toPascalCase(val);

        header("📂 Angular CLI : Module");
        console.log(boilerCLIModule(val));
        await keypress();

        header("📝 app-routing.module.ts");
        console.log(boilerRouting(pathName, val, className));
        await keypress();

        header(`📝 ${val}-routing.module.ts`);
        console.log(boilerRoutingModule(className));
        await keypress();

        header("📝 app.component.html");
        console.log(boilerMenu(pathName, formal));
        await keypress();

        header("📂 Angular CLI : Model and Components");
        console.log(boilerCLIModelComp(val));
        console.log("\n\nYou need edit your interface model!!!");
        await keypress();

        const model = fs.readFileSync(`src/app/${val}/${val}.model.ts`, {
          encoding: "utf8",
          flag: "r",
        });
        const ps = await tsParser.parseSource(model);
        const fields = ps.declarations[0].properties.filter(
          (f) => !/^(id|createdAt|updatedAt)$/.test(f.name)
        );

        header(`📝 ${val}-form.component.ts\n`);
        for (const f of fields) {
          console.log(await generateValidators(f));
        }
        await keypress();

        header(`📝 ${val}-form.component.html\n`);
        for (const f of fields) {
          // console.log(await generateValidators(f));
          console.log(`
<mat-form-field class="">
  <mat-label>${toFormalCase(f.name)}</mat-label>
  <input matInput type="text" placeholder="${toFormalCase(f.name)}" formControlName="${f.name}">
  <mat-error *ngIf="form.controls.${f.name}.hasError('required')">
    Campo é requerido.
  </mat-error>
</mat-form-field>
`);
        }
        await keypress();
      }
    }
  }
}

async function generateValidators(f) {
  const validators = [];
  let line;
  if (/^(string|number|Date)$/.test(f.type)) {
    if (!f.isOptional) validators.push("Validators.required");
    if (f.name.toLowerCase().includes("email"))
      validators.push("Validators.email");
    switch (f.type) {
      case "number":
        validators.push("CustomValidators.number()");
        break;
      case "Date":
        validators.push("CustomValidators.date()");
    }
    return `${f.name}: ['', [${validators.join(", ")}]],`;
  } else {
    const ps = await tsParser.parseSource(
      `interface ${toPascalCase(f.name)} ${f.type}`
    );
    // const lines = [];
    // for (const i of ps.declarations[0].properties) {
    //   lines.push(await generateValidators(i));
    // }
    const lines = await Promise.all(
      ps.declarations[0].properties.map(
        async (i) => await generateValidators(i)
      )
    );
    return `${f.name}: this.fb.group(\n   ${lines.join("\n   ")}\n),`;
  }
}

function header(val) {
  console.log("\033[1;35m" + val + "\033[0m");
}

function detectCase(val) {
  const cases = { snake: false, kebab: false, camel: false, pascal: false };
  if (val[0] === val[0].toUpperCase()) cases.pascal = true;
  else {
    if (val.indexOf("_") !== -1) cases.snake = true;
    else if (val.indexOf("-") !== -1) cases.kebab = true;
    else if (val !== val.toLowerCase()) cases.camel = true;
    else {
      cases.snake = true;
      cases.kebab = true;
      cases.camel = true;
    }
  }
  return cases;
}

function toPascalCase(val) {
  return val
    .split("-")
    .map((w) => w[0].toUpperCase() + w.substring(1))
    .join("");
}

function toFormalCase(val) {
  return val
    .split("-")
    .map((w) => w[0].toUpperCase() + w.substring(1))
    .join(" ");
}

if (process.argv.length === 2) {
  console.log(`************ Ng Stone 🪨 ************

Generate some boilerplate automation for Angular 2+.

Arguments:

-m your-module-name
-m your-module-name "Your Formal Name"
`);
}

const boilerCLIModule = (val) => `
ng g m ${val} --routing
`;

const boilerCLIModelComp = (val) => `
ng g i ${val}/${val} model
ng g c ${val}/${val}-datatable
ng g c ${val}/${val}-form
`;

const boilerAngularCLI = (val) => `
ng g s ${val}/${val}
`;

const boilerRouting = (pathName, val, className) => `
{
   path: '${pathName}',
   loadChildren: () => import('./${val}/${val}.module').then(m => m.${className}Module),
},
`;

const boilerMenu = (pathName, formal) => `
<a mat-list-item routerLink="${pathName}" routerLinkActive="active">
  <mat-icon mat-list-icon>menu</mat-icon>
  <span mat-line>${formal}</span>
</a>
`;

const boilerRoutingModule = (className) => `
{ path: '', component: ${className}DatatableComponent },
{ path: 'create', component: ${className}FormComponent },
{ path: ':id/edit', component: ${className}FormComponent },
`;

const keypress = async () => {
  process.stdin.setRawMode(true);
  return new Promise((resolve) =>
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      resolve();
    })
  );
};

main().then(process.exit);

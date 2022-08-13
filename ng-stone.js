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
          console.log(await generateFields(f));
        }
        await keypress();

        header(`📝 ${val}-datatable.component.html\n`);
        for (const f of ps.declarations[0].properties) {
          console.log(await generateColumns(f));
        }
        console.log(boilerActions, "\n");
        await keypress();

        header(`📝 ${val}-datatable.component.ts\n`);
        let list = [];
        for (const f of ps.declarations[0].properties) {
          const item = await generateColumnsString(f);
          if (typeof item === "string") list.push(item);
          else list = list.concat(item);
        }
        list.push("actions");
        console.log("[" + list.map((v) => `'${v}'`).join(", ") + "]");
        await keypress();

        header(`\n📝 ${val}.service.ts`);
        console.log(bolierService(className, val));
      }
    }
  }
}

async function generateColumnsString(f) {
  if (/^(string|number|Date)$/.test(f.type)) {
    return f.name;
  } else {
    const ps = await tsParser.parseSource(
      `interface ${toPascalCase(f.name)} ${f.type}`
    );
    const lines = await Promise.all(
      ps.declarations[0].properties.map(
        async (i) => await generateColumnsString(i)
      )
    );
    return lines;
  }
}

async function generateColumns(f) {
  if (/^(string|number|Date)$/.test(f.type)) {
    let pipe = "";
    switch (f.type) {
      case "Date":
        pipe = " | date : 'short' : '' : 'pt-BR'";
    }
    return boilerTableColumn(f.name, pipe, true);
  } else {
    const ps = await tsParser.parseSource(
      `interface ${toPascalCase(f.name)} ${f.type}`
    );
    const lines = await Promise.all(
      ps.declarations[0].properties.map(async (i) => await generateColumns(i))
    );
    return lines.join("\n");
  }
}

async function generateFields(f) {
  if (/^(string|number|Date)$/.test(f.type)) {
    const validators = [];
    if (!f.isOptional)
      validators.push(boilerMatError(f.name, "required", "Campo é requerido"));
    if (f.name.toLowerCase().includes("email"))
      validators.push(boilerMatError(f.name, "email", "E-mail inválido"));
    let type;
    switch (f.type) {
      case "number":
        type = "number";
        break;
      case "Date":
        type = "date";
        validators.push(boilerMatError(f.name, "pattern", "Formato inválido"));
        break;
      default:
        type = "text";
    }
    return boilerMatForm(f.name, type, validators);
  } else {
    const ps = await tsParser.parseSource(
      `interface ${toPascalCase(f.name)} ${f.type}`
    );
    const lines = await Promise.all(
      ps.declarations[0].properties.map(async (i) => await generateFields(i))
    );
    return `\n<fieldset class="ocupy flex-form" formGroupName="${
      f.name
    }">\n${lines.join("\n   ")}\n\n</fieldset>`;
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

const keypress = async () => {
  process.stdin.setRawMode(true);
  return new Promise((resolve) =>
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      resolve();
    })
  );
};

const boilerCLIModule = (val) => `
ng g m ${val} --routing
`;

const boilerCLIModelComp = (val) => `
ng g i ${val}/${val} model
ng g c ${val}/${val}-datatable
ng g c ${val}/${val}-form
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

const boilerMatError = (name, type, msg) => `
  <mat-error *ngIf="form.controls.${name}.hasError('${type}')">
   ${msg}.
  </mat-error>`;

const boilerMatForm = (name, type, validates) => `
<mat-form-field class="">
  <mat-label>${toFormalCase(name)}</mat-label>
  <input matInput type="${type}" placeholder="${toFormalCase(
  name
)}" formControlName="${name}">${validates.join("\n")}
</mat-form-field>`;

const boilerTableColumn = (name, pipe, hasSort) => `
<!-- ${name} Column -->
<ng-container matColumnDef="${name}">
  <th mat-header-cell *matHeaderCellDef${
    hasSort ? " mat-sort-header" : ""
  }>${toFormalCase(name)}</th>
  <td mat-cell *matCellDef="let element">{{element.${name}${pipe}}}</td>
</ng-container>`;

const boilerActions = `
<!-- Actions Column -->
<ng-container matColumnDef="actions">
  <th mat-header-cell *matHeaderCellDef>Ações</th>
  <td mat-cell *matCellDef="let element">
    <button mat-icon-button color="primary" (click)="onUpdate(element.id)">
      <mat-icon>edit</mat-icon>
    </button>
    <button mat-icon-button color="accent" (click)="onDelete(element.id)">
      <mat-icon>delete</mat-icon>
    </button>
  </td>
</ng-container>`;

const bolierService = (className, val) => `
index(): Observable<${className}[]> {
  return from(db.${val}.toArray()).pipe(delay(1), take(1));
}

show(id: number): Observable<${className}> {
  return from(db.${val}.get(parseInt(\`\${id}\`))).pipe(
    map(ent => ent ? <${className}>ent : <${className}>{}),
    take(1)
  );
}

private transformToSave(entity: ${className}): ${className} {
  entity.updatedAt = new Date();
  return entity;
}

store(entity: ${className}): Observable<number> {
  entity = this.transformToSave(entity);
  entity.createdAt = new Date();
  return from(db.${val}.add(entity)).pipe(take(1));
}

update(entity: ${className}): Observable<number> {
  entity = this.transformToSave(entity);
  return from(db.${val}.put(entity)).pipe(take(1));
}
`;

main().then(process.exit);

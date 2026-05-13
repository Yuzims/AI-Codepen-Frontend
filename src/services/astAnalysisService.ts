// AST分析服务 - 提供基于AST的智能代码补全
import * as parser from '@babel/parser';//解析js代码为AST
import { parse as parseVue } from '@vue/compiler-sfc';//解析Vue单文件组件
import { parse } from 'node:path';

// 类型定义
export interface Position {
  line: number;
  column: number;
}
//代码补全的建议项
export interface CompletionItem {
  label: string;//显示文本
  insertText: string;//插入文本
  kind: 'variable' | 'function' | 'class' | 'property' | 'method' | 'keyword' | 'module';
  detail?: string;
  documentation?: string;
  sortText?: string;
}
//代码的作用域
export interface Scope {
  variables: Map<string, VariableInfo>;//键为变量名，值为变量的详细信息
  functions: Map<string, FunctionInfo>;
  classes: Map<string, ClassInfo>;
  imports: ImportInfo[];
  parent?: Scope;
}
// 变量的详细信息，记录变量的声明方式和类型
export interface VariableInfo {
  name: string;
  type: string;
  declaration: any;
  isConst: boolean;
  isLet: boolean;
  isVar: boolean;
}
// 函数的详细信息，记录函数的参数和返回类型
export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  declaration: any;
}
// 类的详细信息，记录类的方法和属性
export interface ClassInfo {
  name: string;
  methods: Map<string, MethodInfo>;
  properties: Map<string, PropertyInfo>;
  extends?: string;
  declaration: any;
}
// 类方法的详细信息，记录方法的参数、返回类型和是否为静态方法
export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType?: string;
  isStatic: boolean;
  declaration: any;
}
// 类属性的详细信息
export interface PropertyInfo {
  name: string;
  type: string;
  isStatic: boolean;
  declaration: any;
}
// 函数或方法参数的详细信息
export interface ParameterInfo {
  name: string;
  type?: string;
  defaultValue?: string;
}
// 模块导入的信息
export interface ImportInfo {
  module: string;//路径
  members: string[];//被导入的成员名称数组
  isDefault: boolean;
  alias?: string;//别名
}
// 代码补全的上下文信息
export interface ContextInfo {
  scope: Scope;
  objectType: 'variable' | 'function' | 'class' | 'module' | 'jsx' | 'vue' | 'property' | 'unknown';
  accessPath: string[];//访问路径
  propertyName?: string;
  variableTypes: Map<string, string>;//键为变量名，值为变量的类型
  imports: ImportInfo[];
  fileType: 'js' | 'ts' | 'react' | 'vue';//当前文件的类型
  position: Position;
  currentNode?: any;
  parentNode?: any;
}
//代码的语法结构
export interface ASTNode {
  type: string;
  [key: string]: any;
}

// AST分析服务主类
export class ASTAnalysisService {
  private parser: typeof parser;//解析器
  private vueCompiler: { parse: typeof parseVue };//Vue解析器

  constructor() {
    this.parser = parser;
    this.vueCompiler = { parse: parseVue };
  }

  // 解析不同语言的代码
  parseCode(code: string, language: 'js' | 'ts' | 'react' | 'vue'): ASTNode | null {
    try {
      // 检查代码是否为空或只包含空白字符
      if (!code || code.trim().length === 0) {
        return null;
      }
      
      // 检查代码是否以不完整的表达式结尾（如 user.）
      const trimmedCode = code.trim();
      if (trimmedCode.endsWith('.') || trimmedCode.endsWith('(') || trimmedCode.endsWith('[')) {
        console.log('AST parsing skipped - incomplete expression detected');
        return null;
      }
      
      switch (language) {
        case 'js':
          return this.parseJavaScript(code);
        case 'ts':
          return this.parseTypeScript(code);
        case 'react':
          return this.parseReact(code);
        case 'vue':
          return this.parseVue(code);
        default:
          return null;
      }
    } catch (error) {
      console.warn('AST parsing failed:', error);
      return null;
    }
  }

  // 分析上下文
  analyzeContext(ast: ASTNode, cursorPosition: Position, language: 'js' | 'ts' | 'react' | 'vue',code: string): ContextInfo {
    const analyzer = new ContextAnalyzer(this.vueCompiler);
    return analyzer.analyze(ast, cursorPosition, language, code);
  }

  // 生成补全建议
  generateCompletions(context: ContextInfo): CompletionItem[] {
    const generator = new CompletionGenerator();
    return generator.generate(context);
  }

  // 私有方法：解析JavaScript
  private parseJavaScript(code: string): ASTNode {//返回的 AST 是一个树形结构，每个节点包含 type 和其他属性
    return this.parser.parse(code, {
      sourceType: 'module',//指定源代码类型为ES模块
      plugins: [//启用解析器的插件，以支持特定的语法特性
        'jsx',
        'decorators-legacy',//装饰性语法
        'classProperties',
        'objectRestSpread',//对象的剩余属性和展开操作
        'optionalChaining',//可选链操作符?.
        'nullishCoalescingOperator'//空值合并操作符??
      ]
    });
  }

  // 私有方法：解析TypeScript
  private parseTypeScript(code: string): ASTNode {
    return this.parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator'
      ]
    });
  }

  // 私有方法：解析React
  private parseReact(code: string): ASTNode {
    return this.parseJavaScript(code); // React使用JSX，复用JavaScript解析器
  }

  // 私有方法：解析Vue
  private parseVue(code: string): ASTNode {
    const { descriptor } = this.vueCompiler.parse(code);//descriptor 是一个对象，包含了 Vue 文件的模板(template)、脚本(script)和样式(styles)部分的解析结果
    
    return {
      type: 'VueFile',
      template: descriptor.template ? descriptor.template : undefined,
      script: descriptor.script ? this.parseJavaScript(descriptor.script.content) : undefined,
      styles: descriptor.styles || []
    };
  }
}

// 上下文分析器（确定当前编辑位置的相关信息）
class ContextAnalyzer {

    private vueCompiler: { parse: typeof parseVue };

    constructor(vueCompiler: { parse: typeof parseVue }) {
      this.vueCompiler = vueCompiler;
    }

  analyze(ast: ASTNode, position: Position, language: 'js' | 'ts' | 'react' | 'vue', code: string): ContextInfo {
    const scopeAnalyzer = new ScopeAnalyzer();//作用域分析器实例
    const scope = scopeAnalyzer.analyzeScope(ast);
    
    const nodeFinder = new NodeFinder();//节点查找器实例
    const { currentNode, parentNode } = nodeFinder.findNodeAtPosition(ast, position);//position为光标位置
    
    const objectType = this.determineObjectType(currentNode, parentNode, language, code);
    const accessPath = this.extractAccessPath(currentNode, parentNode);
    const propertyName = this.extractPropertyName(currentNode);
    
    return {
      scope,
      objectType,
      accessPath,
      propertyName,
      variableTypes: scopeAnalyzer.getVariableTypes(scope),
      imports: scopeAnalyzer.getImports(scope),
      fileType: language,
      position,
      currentNode,
      parentNode
    };
  }

  //私有方法：确定当前编辑位置的对象类型ObjectType
  private determineObjectType(currentNode: any, parentNode: any, language: string, code: string): ContextInfo['objectType'] {
    if (!currentNode) return 'unknown';
    
    if (language === 'vue' && this.isInVueTemplate(currentNode, code)) {
      return 'vue';
    }
    
    if (language === 'react' && this.isJSXElement(currentNode)) {
      return 'jsx';
    }
    
    // 检查是否是成员表达式的属性部分（如 user.name 中的 name）
    if (currentNode.type === 'Identifier' && parentNode && parentNode.type === 'MemberExpression') {
        //在 MemberExpression 节点中，object 表示对象，property 表示属性
      if (parentNode.property === currentNode) {
        return 'property'; // 正在访问属性
      } else if (parentNode.object === currentNode) {
        return 'variable'; // 正在访问对象
      }
    }
    
    // 检查是否是成员表达式（如 user.）
    if (currentNode.type === 'MemberExpression') {
      // 如果属性部分为空或未完成，说明正在输入属性
      if (!currentNode.property || currentNode.property.type === 'Identifier' && currentNode.property.name === '') {
        return 'property';
      }
      return 'variable';
    }
    
    // 检查是否是标识符（变量名）
    if (currentNode.type === 'Identifier') {
      return 'variable';
    }
    
    // 检查是否是函数调用
    if (currentNode.type === 'CallExpression') {
      return 'function';
    }
    
    // 检查是否是类声明
    if (currentNode.type === 'ClassDeclaration' || currentNode.type === 'ClassExpression') {
      return 'class';
    }
    
    // 检查是否是函数声明
    if (currentNode.type === 'FunctionDeclaration' || currentNode.type === 'FunctionExpression') {
      return 'function';
    }
    
    // 检查是否是变量声明
    if (currentNode.type === 'VariableDeclaration') {
      return 'variable';
    }
    
    return 'unknown';
  }

  //提取访问路径path（从当前节点到根节点的路径）
  private extractAccessPath(currentNode: any, parentNode: any): string[] {
    const path: string[] = [];
    
    // 如果当前节点是成员表达式，提取完整路径
    if (currentNode && currentNode.type === 'MemberExpression') {
      this.extractMemberExpressionPath(currentNode, path);
    }
    // 如果当前节点是标识符，且父节点是成员表达式
    else if (currentNode && currentNode.type === 'Identifier' && parentNode && parentNode.type === 'MemberExpression') {
      if (parentNode.object === currentNode) {
        // 当前节点是对象名，提取对象名
        path.unshift(currentNode.name);
      } else if (parentNode.property === currentNode) {
        // 当前节点是属性名，提取完整路径
        this.extractMemberExpressionPath(parentNode, path);
      }
    }
    // 如果当前节点是标识符，且父节点不是成员表达式
    else if (currentNode && currentNode.type === 'Identifier') {
      path.unshift(currentNode.name);
    }
    
    return path;
  }

  //私有方法：提取成员表达式路径
  private extractMemberExpressionPath(node: any, path: string[]): void {
    // 提取属性名
    if (node.property && node.property.type === 'Identifier') {
      path.unshift(node.property.name);
    }
    
    // 递归提取对象路径
    if (node.object && node.object.type === 'MemberExpression') {
      this.extractMemberExpressionPath(node.object, path);
    } else if (node.object && node.object.type === 'Identifier') {
      path.unshift(node.object.name);
    }
  }

  //提取属性名
  private extractPropertyName(currentNode: any): string | undefined {
    if (currentNode && currentNode.type === 'Identifier') {
      return currentNode.name;
    }
    
    if (currentNode && currentNode.type === 'MemberExpression' && currentNode.property && currentNode.property.type === 'Identifier') {
      return currentNode.property.name;
    }
    
    return undefined;
  }


  //私有方法：检查节点是否在Vue模板<template>中
  private isInVueTemplate(node: any, code: string): boolean {
    const {descriptor} = this.vueCompiler.parse(code);

    // 检查当前节点是否在模板部分的 AST 中
    if (descriptor.template && descriptor.template.ast) {
      return this.isNodeInAST(node, descriptor.template.ast);
    }
    
    return false;
  }

  private isNodeInAST(node: any, ast: any): boolean {
    if (ast === node) {
      return true;
    }

    for (const key in ast) {
      if (ast[key] && typeof ast[key] === 'object') {
        if (this.isNodeInAST(node, ast[key])) {
          return true;
        }
      }
    }

    return false;
  }



  private isJSXElement(node: any): boolean {
    return node.type === 'JSXElement' || node.type === 'JSXIdentifier';
  }
}

// 作用域分析器，返回一个Scope对象，包含变量、函数、类、导入等信息
class ScopeAnalyzer {
  analyzeScope(ast: ASTNode): Scope {
    const scope: Scope = {
      variables: new Map(),
      functions: new Map(),
      classes: new Map(),
      imports: []
    };

    this.traverseAST(ast, scope);
    return scope;
  }

  //私有方法：遍历AST，分析作用域
  private traverseAST(node: any, scope: Scope): void {
    if (!node) return;

    // 分析变量声明
    if (node.type === 'VariableDeclaration') {
      this.analyzeVariableDeclaration(node, scope);
    }

    // 分析函数声明
    if (node.type === 'FunctionDeclaration') {
      this.analyzeFunctionDeclaration(node, scope);
    }

    // 分析类声明
    if (node.type === 'ClassDeclaration') {
      this.analyzeClassDeclaration(node, scope);
    }

    // 分析导入语句
    if (node.type === 'ImportDeclaration') {
      this.analyzeImportDeclaration(node, scope);
    }

    // 递归遍历子节点
    Object.keys(node).forEach(key => {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverseAST(item, scope));
      } else if (child && typeof child === 'object') {
        this.traverseAST(child, scope);
      }
    });
  }

  private analyzeVariableDeclaration(node: any, scope: Scope): void {
    if (node.declarations) {//node.declarations 是一个数组，包含当前变量声明节点中的所有变量声明
      node.declarations.forEach((declaration: any) => {
        if (declaration.id && declaration.id.type === 'Identifier') {
          const variableInfo: VariableInfo = {
            name: declaration.id.name,
            type: this.inferType(declaration.init),//变量类型
            declaration: node,//存储当前变量声明的完整节点信息
            isConst: node.kind === 'const',
            isLet: node.kind === 'let',
            isVar: node.kind === 'var'
          };
          scope.variables.set(declaration.id.name, variableInfo);
        }
      });
    }
  }

  private analyzeFunctionDeclaration(node: any, scope: Scope): void {
    if (node.id && node.id.type === 'Identifier') {
      const functionInfo: FunctionInfo = {
        name: node.id.name,
        parameters: this.extractParameters(node.params),
        returnType: undefined,
        declaration: node
      };
      scope.functions.set(node.id.name, functionInfo);
    }
  }

  private analyzeClassDeclaration(node: any, scope: Scope): void {
    if (node.id && node.id.type === 'Identifier') {
      const classInfo: ClassInfo = {
        name: node.id.name,
        methods: new Map(),
        properties: new Map(),
        extends: node.superClass ? this.extractClassName(node.superClass) : undefined,//提取父节点的类名
        declaration: node
      };

      // 分析类成员
      if (node.body && node.body.body) {
        node.body.body.forEach((member: any) => {
          if (member.type === 'ClassMethod') {
            const methodInfo: MethodInfo = {
              name: member.key && member.key.type === 'Identifier' ? member.key.name : '',
              parameters: this.extractParameters(member.params),
              returnType: undefined,
              isStatic: member.static || false,
              declaration: member
            };
            classInfo.methods.set(methodInfo.name, methodInfo);
          } else if (member.type === 'ClassProperty') {
            const propertyInfo: PropertyInfo = {
              name: member.key && member.key.type === 'Identifier' ? member.key.name : '',
              type: this.inferType(member.value),//属性类型
              isStatic: member.static || false,
              declaration: member
            };
            classInfo.properties.set(propertyInfo.name, propertyInfo);
          }
        });
      }

      scope.classes.set(node.id.name, classInfo);
    }
  }

  private analyzeImportDeclaration(node: any, scope: Scope): void {
    const importInfo: ImportInfo = {
      module: node.source ? node.source.value : '',
      members: [],
      isDefault: false,
      alias: undefined
    };

    if (node.specifiers) {//该数组包含节点的所有导入说明符
      node.specifiers.forEach((specifier: any) => {
        if (specifier.type === 'ImportDefaultSpecifier') {//默认导入说明符
          importInfo.isDefault = true;
          importInfo.members.push('default');
        } else if (specifier.type === 'ImportSpecifier') {//命名导入说明符
          if (specifier.imported && specifier.imported.type === 'Identifier') {
            importInfo.members.push(specifier.imported.name);
            if (specifier.local && specifier.local.name !== specifier.imported.name) {
              importInfo.alias = specifier.local.name;
            }
          }
        }
      });
    }

    scope.imports.push(importInfo);
  }

  //私有方法：提取函数参数
  private extractParameters(params: any[]): ParameterInfo[] {
    if (!params) return [];
    
    return params.map(param => {
      if (param.type === 'Identifier') {
        return {
          name: param.name,
          type: undefined,
          defaultValue: undefined
        };
      }
      //这里还可以改进，对于解构参数的类型推断
      return {
        name: 'param',
        type: undefined,
        defaultValue: undefined
      };
    });
  }
  
  //私有方法：提取类名
  private extractClassName(node: any): string {
    if (node && node.type === 'Identifier') {
      return node.name;
    }
    return 'unknown';
  }

  //私有方法：推断变量类型
  private inferType(node: any): string {
    if (!node) return 'any';

    if (node.type === 'StringLiteral') return 'string';
    if (node.type === 'NumericLiteral') return 'number';
    if (node.type === 'BooleanLiteral') return 'boolean';
    if (node.type === 'ArrayExpression') return 'array';
    if (node.type === 'ObjectExpression') return 'object';
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return 'function';
    if (node.type === 'NullLiteral') return 'null';
    if (node.type === 'Identifier') return 'any';

    return 'any';
  }

  
  getVariableTypes(scope: Scope): Map<string, string> {
    const types = new Map<string, string>();
    scope.variables.forEach((variable, name) => {//name为每一个variable的键
      types.set(name, variable.type);
    });
    return types;
  }

  getImports(scope: Scope): ImportInfo[] {
    return scope.imports;
  }
}

// 节点查找器
class NodeFinder {
  findNodeAtPosition(ast: ASTNode, position: Position): { currentNode?: any; parentNode?: any } {
    let currentNode: any;
    let parentNode: any;
    let bestMatch: any = null;
    let bestParent: any = null;
    let bestScore = -1;

    // 递归遍历AST查找最精确的节点
    this.traverseAndFindNode(ast, position, null, (node, parent, score) => {
      if (score > bestScore) {
        bestScore = score;
        bestMatch = node;
        bestParent = parent;
      }
    });

    return { 
      currentNode: bestMatch, 
      parentNode: bestParent 
    };
  }

  private traverseAndFindNode(node: any, position: Position, parent: any, callback: (node: any, parent: any, score: number) => void): void {
    if (!node) return;

    // 计算节点与光标位置的匹配度
    const score = this.calculateNodeScore(node, position);
    if (score > 0) {
      callback(node, parent, score);
    }

    // 递归遍历子节点
    Object.keys(node).forEach(key => {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((item: any) => this.traverseAndFindNode(item, position, node, callback));
      } else if (child && typeof child === 'object') {
        this.traverseAndFindNode(child, position, node, callback);
      }
    });
  }

  private calculateNodeScore(node: any, position: Position): number {
    if (!node.loc) return 0;//检查节点是否包含位置信息

    const startLine = node.loc.start.line;
    const startColumn = node.loc.start.column;
    const endLine = node.loc.end.line;
    const endColumn = node.loc.end.column;

    // 检查光标是否在节点范围内
    if (this.isPositionInRange(position, startLine, startColumn, endLine, endColumn)) {
      let score = 100; // 基础分数

      // 根据节点类型调整分数
      switch (node.type) {
        case 'Identifier':
          score += 50; // 标识符优先级最高
          break;
        case 'MemberExpression':
          score += 40; // 成员表达式优先级高
          break;
        case 'VariableDeclaration':
          score += 30;
          break;
        case 'FunctionDeclaration':
          score += 25;
          break;
        case 'ClassDeclaration':
          score += 25;
          break;
        case 'ExpressionStatement':
          score += 20;
          break;
        case 'Program':
          score += 10; // 程序根节点优先级最低
          break;
        default:
          score += 15;
      }

      // 根据节点大小调整分数（更小的节点优先级更高）
      const nodeSize = (endLine - startLine) * 1000 + (endColumn - startColumn);
      score -= Math.min(nodeSize / 10, 20); // 最多减20分

      return score;
    }

    return 0;
  }

  private isPositionInRange(position: Position, startLine: number, startColumn: number, endLine: number, endColumn: number): boolean {
    // 检查位置是否在范围内
    if (position.line < startLine || position.line > endLine) {
      return false;
    }

    if (position.line === startLine && position.column < startColumn) {
      return false;
    }

    if (position.line === endLine && position.column > endColumn) {
      return false;
    }

    return true;
  }

  //以下查找特定节点方法，用于点击跳转功能
  // 查找特定类型的节点
  findNodeOfType(ast: ASTNode, position: Position, nodeType: string): any {
    let result: any = null;
    let bestScore = -1;

    this.traverseAndFindNode(ast, position, null, (node, parent, score) => {
      if (node.type === nodeType && score > bestScore) {
        bestScore = score;
        result = node;
      }
    });

    return result;
  }

  // 查找变量声明节点
  findVariableDeclaration(ast: ASTNode, position: Position, variableName: string): any {
    let result: any = null;

    this.traverseAndFindNode(ast, position, null, (node, parent, score) => {
      if (node.type === 'VariableDeclaration' && 
          node.declarations && 
          node.declarations.some((decl: any) => decl.id && decl.id.name === variableName)) {
        result = node;
      }
    });

    return result;
  }

  // 查找函数声明节点
  findFunctionDeclaration(ast: ASTNode, position: Position, functionName: string): any {
    let result: any = null;

    this.traverseAndFindNode(ast, position, null, (node, parent, score) => {
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && 
          node.id && node.id.name === functionName) {
        result = node;
      }
    });

    return result;
  }

  // 查找类声明节点
  findClassDeclaration(ast: ASTNode, position: Position, className: string): any {
    let result: any = null;

    this.traverseAndFindNode(ast, position, null, (node, parent, score) => {
      if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && 
          node.id && node.id.name === className) {
        result = node;
      }
    });

    return result;
  }
}

// 补全生成器
class CompletionGenerator {
  generate(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    switch (context.objectType) {
      case 'variable':
        completions.push(...this.generateVariableCompletions(context));
        break;
      case 'property':
        completions.push(...this.generatePropertyCompletions(context));
        break;
      case 'function':
        completions.push(...this.generateFunctionCompletions(context));
        break;
      case 'class':
        completions.push(...this.generateClassCompletions(context));
        break;
      case 'jsx':
        completions.push(...this.generateJSXCompletions(context));
        break;
      case 'vue':
        completions.push(...this.generateVueCompletions(context));
        break;
      default:
        completions.push(...this.generateGlobalCompletions(context));
    }

    return completions;
  }

  private generateVariableCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加作用域中的变量
    context.scope.variables.forEach((variable, name) => {
      completions.push({
        label: name,
        insertText: name,
        kind: 'variable',
        detail: `${variable.type} (${variable.isConst ? 'const' : variable.isLet ? 'let' : 'var'})`,
        documentation: `Variable: ${name}`
      });
    });

    // 添加全局对象
    this.addGlobalObjects(completions);

    return completions;
  }

  private generatePropertyCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    if (context.accessPath.length > 0) {
      const objectName = context.accessPath[0];
      const variable = context.scope.variables.get(objectName);
      
      if (variable) {
        // 根据变量类型添加相应的属性
        this.addTypeSpecificProperties(completions, variable.type);
      }
    }

    return completions;
  }

  private generateFunctionCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加作用域中的函数
    context.scope.functions.forEach((func, name) => {
      completions.push({
        label: name,
        insertText: name,
        kind: 'function',
        detail: `function ${name}(${func.parameters.map(p => p.name).join(', ')})`,
        documentation: `Function: ${name}`
      });
    });

    return completions;
  }

  private generateClassCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加作用域中的类
    context.scope.classes.forEach((cls, name) => {
      completions.push({
        label: name,
        insertText: name,
        kind: 'class',
        detail: `class ${name}`,
        documentation: `Class: ${name}`
      });
    });

    return completions;
  }

  private generateJSXCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加React组件
    context.scope.classes.forEach((cls, name) => {
      if (name.endsWith('Component') || name.includes('Component')) {
        completions.push({
          label: name,
          insertText: name,
          kind: 'class',
          detail: `React Component: ${name}`,
          documentation: `React Component: ${name}`
        });
      }
    });

    // 添加JSX属性
    this.addJSXAttributes(completions);

    return completions;
  }

  private generateVueCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加Vue指令
    this.addVueDirectives(completions);

    // 添加Vue事件
    this.addVueEvents(completions);

    return completions;
  }

  private generateGlobalCompletions(context: ContextInfo): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // 添加全局对象
    this.addGlobalObjects(completions);

    // 添加关键字
    this.addKeywords(completions, context.fileType);

    return completions;
  }

  private addGlobalObjects(completions: CompletionItem[]): void {
    const globalObjects = [
      'console', 'window', 'document', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Symbol', 'RegExp', 'Error', 'JSON'
    ];

    globalObjects.forEach(obj => {
      completions.push({
        label: obj,
        insertText: obj,
        kind: 'variable',
        detail: `Global ${obj}`,
        documentation: `Global object: ${obj}`
      });
    });
  }

  private addTypeSpecificProperties(completions: CompletionItem[], type: string): void {
    switch (type) {
      case 'string':
        this.addStringMethods(completions);
        break;
      case 'array':
        this.addArrayMethods(completions);
        break;
      case 'object':
        this.addObjectMethods(completions);
        break;
      case 'number':
        this.addNumberMethods(completions);
        break;
    }
  }

  private addStringMethods(completions: CompletionItem[]): void {
    const methods = ['length', 'charAt', 'charCodeAt', 'concat', 'indexOf', 'lastIndexOf', 'slice', 'substring', 'toLowerCase', 'toUpperCase', 'trim', 'replace', 'split'];
    methods.forEach(method => {
      completions.push({
        label: method,
        insertText: method,
        kind: 'method',
        detail: `string.${method}`,
        documentation: `String method: ${method}`
      });
    });
  }

  private addArrayMethods(completions: CompletionItem[]): void {
    const methods = ['length', 'push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'concat', 'join', 'reverse', 'sort', 'indexOf', 'lastIndexOf', 'forEach', 'map', 'filter', 'reduce', 'find', 'findIndex', 'includes'];
    methods.forEach(method => {
      completions.push({
        label: method,
        insertText: method,
        kind: 'method',
        detail: `array.${method}`,
        documentation: `Array method: ${method}`
      });
    });
  }

  private addObjectMethods(completions: CompletionItem[]): void {
    const methods = ['keys', 'values', 'entries', 'assign', 'create', 'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor', 'getOwnPropertyNames', 'getPrototypeOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toString', 'valueOf'];
    methods.forEach(method => {
      completions.push({
        label: method,
        insertText: method,
        kind: 'method',
        detail: `Object.${method}`,
        documentation: `Object method: ${method}`
      });
    });
  }

  private addNumberMethods(completions: CompletionItem[]): void {
    const methods = ['toFixed', 'toPrecision', 'toString', 'valueOf', 'toExponential'];
    methods.forEach(method => {
      completions.push({
        label: method,
        insertText: method,
        kind: 'method',
        detail: `number.${method}`,
        documentation: `Number method: ${method}`
      });
    });
  }

  private addJSXAttributes(completions: CompletionItem[]): void {
    const attributes = ['className', 'style', 'onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onKeyPress', 'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave', 'disabled', 'readOnly', 'required', 'type', 'value', 'placeholder', 'id', 'name'];
    attributes.forEach(attr => {
      completions.push({
        label: attr,
        insertText: attr,
        kind: 'property',
        detail: `JSX attribute: ${attr}`,
        documentation: `JSX attribute: ${attr}`
      });
    });
  }

  private addVueDirectives(completions: CompletionItem[]): void {
    const directives = ['v-if', 'v-show', 'v-for', 'v-bind', 'v-on', 'v-model', 'v-text', 'v-html', 'v-pre', 'v-cloak', 'v-once'];
    directives.forEach(directive => {
      completions.push({
        label: directive,
        insertText: directive,
        kind: 'keyword',
        detail: `Vue directive: ${directive}`,
        documentation: `Vue directive: ${directive}`
      });
    });
  }

  private addVueEvents(completions: CompletionItem[]): void {
    const events = ['@click', '@change', '@submit', '@keydown', '@keyup', '@keypress', '@focus', '@blur', '@mouseenter', '@mouseleave', '@input'];
    events.forEach(event => {
      completions.push({
        label: event,
        insertText: event,
        kind: 'keyword',
        detail: `Vue event: ${event}`,
        documentation: `Vue event: ${event}`
      });
    });
  }

  private addKeywords(completions: CompletionItem[], fileType: string): void {
    const commonKeywords = ['const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'import', 'export', 'default', 'async', 'await', 'yield', 'super', 'this', 'null', 'undefined', 'true', 'false'];
    
    commonKeywords.forEach(keyword => {
      completions.push({
        label: keyword,
        insertText: keyword,
        kind: 'keyword',
        detail: `keyword: ${keyword}`,
        documentation: `JavaScript keyword: ${keyword}`
      });
    });

    if (fileType === 'ts') {
      const tsKeywords = ['interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract', 'implements', 'extends', 'public', 'private', 'protected', 'readonly', 'static', 'get', 'set'];
      tsKeywords.forEach(keyword => {
        completions.push({
          label: keyword,
          insertText: keyword,
          kind: 'keyword',
          detail: `TypeScript keyword: ${keyword}`,
          documentation: `TypeScript keyword: ${keyword}`
        });
      });
    }
  }
} 
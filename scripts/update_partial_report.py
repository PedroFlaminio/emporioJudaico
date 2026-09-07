from __future__ import annotations

import copy
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "Modelo_-_Relatorio_Parcial.docx"
BACKUP = ROOT / "Modelo_-_Relatorio_Parcial.original.docx"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
ET.register_namespace("w", W)


def qn(name: str) -> str:
    return f"{{{W}}}{name}"


def paragraph_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))


def set_paragraph_text(paragraph: ET.Element, value: str) -> None:
    paragraph_properties = paragraph.find("w:pPr", NS)
    first_run_properties = paragraph.find(".//w:r/w:rPr", NS)
    for child in list(paragraph):
        if child is not paragraph_properties:
            paragraph.remove(child)
    run = ET.SubElement(paragraph, qn("r"))
    if first_run_properties is not None:
        run.append(copy.deepcopy(first_run_properties))
    text = ET.SubElement(run, qn("t"))
    if value.startswith(" ") or value.endswith(" "):
        text.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text.text = value


def find_direct_paragraph(body: ET.Element, exact: str) -> ET.Element:
    for child in body:
        if child.tag == qn("p") and paragraph_text(child).strip() == exact:
            return child
    raise ValueError(f"Parágrafo não encontrado: {exact}")


def find_direct_paragraph_starting(body: ET.Element, prefix: str) -> ET.Element:
    for child in body:
        if child.tag == qn("p") and paragraph_text(child).strip().startswith(prefix):
            return child
    raise ValueError(f"Parágrafo não encontrado: {prefix}")


def replace_section(body: ET.Element, start_heading: str, end_heading: str, paragraphs: list[str], template: ET.Element) -> None:
    start = find_direct_paragraph(body, start_heading)
    end = find_direct_paragraph(body, end_heading)
    children = list(body)
    start_index = children.index(start)
    end_index = children.index(end)
    for child in children[start_index + 1:end_index]:
        body.remove(child)
    end_index = list(body).index(end)
    for value in paragraphs:
        new_paragraph = copy.deepcopy(template)
        set_paragraph_text(new_paragraph, value)
        body.insert(end_index, new_paragraph)
        end_index += 1


def update_document(document_xml: bytes) -> bytes:
    root = ET.fromstring(document_xml)
    body = root.find("w:body", NS)
    if body is None:
        raise ValueError("Corpo do documento não encontrado")

    body_template = copy.deepcopy(find_direct_paragraph_starting(body, "De um modo amplo"))

    for paragraph in body.findall("w:p", NS):
        current = paragraph_text(paragraph)
        if current.strip() == "Proposta de Sistema para Gestão de Pedidos do Empório Judaico":
            set_paragraph_text(paragraph, "Sistema Web para Gestão de Pedidos do Empório Judaico")

    catalog = find_direct_paragraph_starting(body, "SCHMIDT, Allan")
    catalog_text = paragraph_text(catalog).replace("FIONSECA", "FONSECA").replace("Proposta de Sistema", "Sistema Web")
    catalog_text = catalog_text.replace("00f. Relatório", "Relatório")
    set_paragraph_text(catalog, catalog_text)

    abstract = find_direct_paragraph_starting(body, "No cenário mundial")
    set_paragraph_text(
        abstract,
        "A transformação digital tornou a gestão integrada de pedidos relevante para organizações comerciais, sobretudo diante do crescimento dos canais digitais e da necessidade de rastrear cada etapa da venda. Este trabalho teve como objetivo desenvolver um sistema web de gestão de pedidos para o Empório Judaico, centralizando informações de clientes, produtos, valores, pagamentos, prazos, produção, preparação e entrega. Adotou-se uma pesquisa aplicada, de caráter exploratório e abordagem qualitativa, organizada nas etapas de ouvir, criar e implementar. A solução foi construída com frontend responsivo em React e TypeScript, API em Elysia, banco de dados PostgreSQL e autenticação com permissões por perfil. Como resultado, foi implementado um fluxo operacional que acompanha o pedido desde o recebimento até a finalização, com histórico de transições, controle de pagamentos totais e parciais, conferência de itens, ocorrências, produção e expedição. A validação técnica incluiu checagem de tipos, geração dos artefatos de produção e testes de integração da API. Conclui-se que a solução operacional atende ao objetivo de reduzir a dispersão das informações, melhorar a rastreabilidade e estabelecer uma base estruturada para o acompanhamento do negócio."
    )
    keywords = find_direct_paragraph_starting(body, "PALAVRAS-CHAVE")
    set_paragraph_text(keywords, "PALAVRAS-CHAVE: Gestão de pedidos; Transformação digital; Sistemas de informação; Banco de dados; Aplicação web.")

    illustrations = find_direct_paragraph(body, "LISTA DE ILUSTRAÇÕES (opcional)")
    summary = find_direct_paragraph(body, "SUMÁRIO")
    children = list(body)
    for child in children[children.index(illustrations):children.index(summary)]:
        body.remove(child)
    summary_instruction = find_direct_paragraph_starting(body, "(Fonte:")
    body.remove(summary_instruction)

    intro_replacements = {
        "De um modo amplo": "De um modo amplo, a transformação digital tem provocado mudanças importantes na forma como as organizações registram, organizam e utilizam informações relacionadas às suas atividades. No ambiente comercial, essa necessidade pode ser observada especialmente na gestão de pedidos, pois cada venda envolve cliente, produtos, valores, pagamentos, prazos e etapas de atendimento. Quando esses registros permanecem distribuídos entre diferentes ferramentas ou setores, o acompanhamento das operações torna-se mais difícil e sujeito a falhas (ARAÚJO et al., 2026; FERNANDES, 2025).",
        "A ideia básica deste Projeto Integrador": "A ideia básica deste Projeto Integrador consistiu em utilizar recursos tecnológicos e uma estrutura organizada de dados para melhorar a gestão de pedidos de um pequeno estabelecimento comercial. A proposta partiu do princípio de que um sistema integrado pode reunir informações dispersas e permitir o acompanhamento de cada pedido desde o recebimento até a conclusão.",
        "Com base nisso ficou estabelecido": "Com base nisso, o foco da pesquisa foi delimitado ao processo de gestão de pedidos do Empório Judaico, um pequeno negócio local. Não se pretendeu desenvolver uma solução genérica para todos os tipos de comércio nem contemplar todos os processos administrativos de uma organização. A proposta concentrou-se nas informações de clientes, produtos, valores, pagamentos, prazos, produção, preparação e expedição.",
        "Outra motivação está relacionada": "Outra motivação está relacionada à possibilidade de utilizar os dados gerados pelo próprio negócio para melhorar sua gestão. A base centralizada implementada registra clientes, produtos, pagamentos, prazos e etapas dos pedidos, formando um histórico estruturado que sustenta o acompanhamento operacional e a verificação das atividades realizadas.",
        "Assim, tem-se que o objeto geral": "Assim, o objetivo geral deste estudo foi desenvolver um sistema web de gestão de pedidos para o Empório Judaico, capaz de reunir em um único local informações de clientes, produtos, valores, pagamentos e prazos. A solução implementada permite acompanhar cada pedido desde o recebimento até a entrega por meio das etapas de pagamento, produção, preparação, expedição e finalização. O sistema inclui interface responsiva, área financeira, histórico auditável e controle de acesso por perfil.",
        "Dessa forma, o projeto busca": "Dessa forma, o projeto aplica conhecimentos do curso de Ciência de Dados à resolução de uma necessidade observada em um pequeno negócio real. A integração entre banco de dados, sistema de informação e preparação dos dados para análise contribui para reduzir controles paralelos, aumentar a rastreabilidade e criar condições para que as informações do Empório Judaico sejam utilizadas de maneira organizada e estratégica."
    }
    for prefix, value in intro_replacements.items():
        set_paragraph_text(find_direct_paragraph_starting(body, prefix), value)

    replace_section(body, "2.1 Objetivos", "2.2 Justificativa e delimitação do problema", [
        "O objetivo geral foi desenvolver e validar um sistema web responsivo para centralizar e acompanhar os pedidos do Empório Judaico desde o recebimento até a entrega.",
        "Como objetivos específicos, estabeleceram-se:",
        "a) identificar as informações e etapas necessárias ao acompanhamento dos pedidos do estabelecimento;",
        "b) modelar uma base de dados para clientes, produtos, pedidos, pagamentos, produção, ocorrências, expedição e histórico;",
        "c) desenvolver uma interface responsiva para cadastro, consulta e atualização do fluxo operacional;",
        "d) implementar controle financeiro para pagamentos pendentes, parciais, pagos, vencidos, cancelados e estornados;",
        "e) estabelecer autenticação, permissões por perfil e rastreabilidade das mudanças;",
        "f) validar tecnicamente os principais fluxos e regras de autorização da solução."
    ], body_template)

    replace_section(body, "2.2 Justificativa e delimitação do problema", "2.3 Fundamentação teórica", [
        "O problema que orientou o projeto foi expresso pela seguinte questão: como centralizar e acompanhar, de maneira simples e rastreável, as informações dos pedidos do Empório Judaico desde o atendimento até a entrega?",
        "A proposta se justifica pela dispersão de dados entre conversas de WhatsApp, controles manuais e diferentes responsáveis. Essa condição exige buscas frequentes, dificulta a identificação da etapa atual do pedido e aumenta o risco de retrabalho, atraso e perda de informações.",
        "A contribuição prática consiste em disponibilizar uma única base operacional para clientes, produtos, valores, pagamentos, prazos e ocorrências. A contribuição acadêmica está na aplicação integrada de conceitos de sistemas de informação, banco de dados, desenvolvimento web, qualidade de dados e análise de dados em uma situação real.",
        "O projeto está delimitado à gestão de pedidos do Empório Judaico. Não contempla, nesta etapa, emissão fiscal, controle completo de estoque, integração automática com WhatsApp ou comércio eletrônico."
    ], body_template)

    replace_section(body, "2.3 Fundamentação teórica", "2.4 Metodologia", [
        "A gestão de pedidos envolve o registro coordenado das informações de uma venda e o acompanhamento de suas mudanças ao longo do atendimento. Araújo et al. (2026) destacam a relevância da comunicação e da atualização do estado dos pedidos, enquanto Fernandes (2025) demonstra a aplicação de sistemas específicos para organizar esse processo.",
        "A centralização em um sistema de informação reduz a dependência de consultas manuais e permite que os diferentes responsáveis utilizem uma mesma fonte de dados. Para isso, não basta armazenar apenas o estado atual: o registro histórico das transições é necessário para rastreabilidade, auditoria e análise dos tempos do processo.",
        "O banco de dados relacional oferece estrutura para representar clientes, produtos, pedidos, itens, pagamentos, produção e expedição, preservando vínculos e regras de integridade. No projeto, essa organização também permite distinguir valor vendido, valor recebido e saldo em aberto, aspecto necessário ao controle de pagamentos parciais.",
        "No sistema desenvolvido, os registros de início e conclusão da produção, datas prometidas e mudanças de etapa permitem acompanhar duração, atrasos e responsabilidades. A estrutura também preserva ocorrências e soluções associadas ao pedido.",
        "A arquitetura em camadas separa a interface, as regras de negócio e a persistência. Essa organização facilita a manutenção, evita que a interface acesse diretamente o banco e permite validar os dados recebidos antes de registrá-los.",
        "A integridade das relações entre pedidos, clientes, produtos e usuários reduz inconsistências e favorece a continuidade do processo entre os setores responsáveis.",
        "A autenticação por usuário e a autorização por perfil complementam a integridade dos dados. Atendimento, produção, financeiro e expedição possuem responsabilidades distintas, de modo que as transições e alterações devem ser permitidas somente aos perfis relacionados à respectiva etapa.",
        "Por fim, a responsividade da interface é relevante para um estabelecimento no qual o registro pode ocorrer em computador, tablet ou celular. A combinação entre interface adaptável, API de negócio e banco centralizado sustenta a proposta de acompanhamento contínuo dos pedidos."
    ], body_template)

    replace_section(body, "2.4 Metodologia", "2.5 Resultados preliminares: solução inicial", [
        "A pesquisa é aplicada, de caráter exploratório e abordagem qualitativa, pois parte de um problema concreto do Empório Judaico e busca produzir uma solução tecnológica adequada ao contexto observado.",
        "O desenvolvimento foi organizado nas etapas ouvir e interpretar o contexto, criar e prototipar, e implementar e testar, conforme a orientação metodológica do Projeto Integrador.",
        "Na etapa de ouvir, foram consideradas as informações fornecidas pelo responsável pelo estabelecimento, a descrição do uso do WhatsApp e de controles manuais, os dados necessários aos pedidos e a atuação dos diferentes responsáveis pela operação.",
        "Na etapa de criar, o processo foi representado pelo fluxo: pedido recebido, pagamento, produção, preparação e conferência, pedido pronto, expedição ou retirada e entrega. Também foram definidos os módulos, perfis de acesso e entidades do banco de dados.",
        "A solução foi prototipada como aplicação web responsiva. O frontend foi desenvolvido com React, Vite e TypeScript; a API utiliza Elysia; e a persistência utiliza PostgreSQL com Drizzle ORM.",
        "Na etapa de implementação, foram construídos painel operacional, quadro de pedidos, detalhes do pedido, produção, preparação, financeiro, expedição e cadastros. As transições geram registros de histórico com usuário e data.",
        "As ressalvas identificadas na revisão de aderência foram incorporadas ao plano e implementadas: endereço completo e dados logísticos, distinção entre total e valor recebido, pagamento parcial com comprovante, e permissões de transição por perfil.",
        "A validação técnica foi realizada por checagem estática de tipos, geração dos builds da API e do frontend e testes de integração conectados ao PostgreSQL. A suíte final executou cinco cenários, totalizando 28 verificações, sem falhas.",
        "Os testes cobriram disponibilidade da API, autenticação, painel, criação de cliente e pedido, histórico, pagamento parcial, informações de expedição e bloqueio ou autorização de transições conforme o perfil.",
        "A avaliação apresentada nesta versão é técnica e preliminar. A coleta formal de devolutivas do responsável pelo estabelecimento e os testes de usabilidade em dispositivos reais permanecem como atividades recomendadas para a continuidade do projeto.",
        "A documentação do código, das regras de negócio e dos testes foi mantida junto ao projeto para facilitar sua continuidade e validação."
    ], body_template)

    replace_section(body, "2.5 Resultados preliminares: solução inicial", "Referências", [
        "Na etapa de ouvir, o principal resultado foi a consolidação do problema: as informações necessárias para acompanhar uma venda estavam distribuídas e dependiam de consultas manuais. Foram identificados como dados essenciais o cliente, os itens, valores, pagamento, data prometida, prioridade, modalidade de entrega, responsável e situação atual.",
        "Na etapa de criar, foi definido um fluxo operacional padronizado que começa no recebimento e passa por confirmação de pagamento, produção, preparação, pedido pronto, expedição e entrega. O desenho inclui retorno controlado de algumas etapas, cancelamento e registro de ocorrências.",
        "A solução implementada utiliza uma arquitetura com frontend web responsivo, API de negócio e banco PostgreSQL. A autenticação é baseada em sessões e os perfis de atendimento, produção, financeiro, expedição, gestor e administrador determinam as operações disponíveis.",
        "O painel operacional apresenta pedidos em andamento, produção, pedidos prontos, valores vencidos, prazos e ocorrências abertas. O quadro Kanban permite localizar pedidos e movimentá-los conforme o fluxo autorizado.",
        "No detalhe do pedido, são exibidos itens, valores, conferência, pagamento, produção, expedição, ocorrências e linha do tempo. A preparação permite marcar itens separados, conferidos, faltantes, substituídos ou avariados.",
        "A área financeira diferencia o valor total, o valor recebido e o saldo. Pagamentos parciais podem ser registrados com forma, vencimento, comprovante e observações, e o histórico de contatos de cobrança permanece associado ao pagamento.",
        "A expedição registra endereço, janela de entrega, transportadora, entregador, código de rastreamento, saída, confirmação de entrega e motivo de tentativa frustrada. As alterações são restritas aos perfis responsáveis pela respectiva etapa.",
        "Os resultados técnicos foram satisfatórios: frontend e API passaram pela checagem de tipos e pelo processo de build, enquanto cinco testes de integração e 28 verificações foram concluídos sem falhas. Esses testes fornecem evidência inicial de funcionamento, mas não substituem a validação com usuários do estabelecimento.",
        "Em relação aos requisitos do relatório, o núcleo operacional encontra-se implementado e alinhado. A interface foi preparada para computador, tablet e celular por meio de pontos de adaptação responsiva. A validação visual em diferentes dispositivos deverá acompanhar os futuros testes de usabilidade.",
        "Como continuidade, recomenda-se realizar testes de usabilidade com os responsáveis pelo estabelecimento, coletar devolutivas formais e registrar imagens das telas em funcionamento para a versão final do relatório."
    ], body_template)

    for reference_prefix in ["CAETANO,", "FERREIRA,", "PAIVA,"]:
        reference = find_direct_paragraph_starting(body, reference_prefix)
        body.remove(reference)

    toc_pages = {
        "1 Introdução": "5",
        "2 Desenvolvimento": "8",
        "2.1 Objetivos": "8",
        "2.2 Justificativa e delimitação do problema": "8",
        "2.3 Fundamentação teórica": "9",
        "2.4 Metodologia": "10",
        "2.5 Resultados preliminares: solução inicial": "11",
        "Referências": "13",
        "Anexos (opcional)": "14",
        "Apêndices (opcional)": "15",
    }
    for title, page in toc_pages.items():
        for candidate in body.findall("w:p", NS):
            text_nodes = candidate.findall(".//w:t", NS)
            if len(text_nodes) >= 2 and "".join(node.text or "" for node in text_nodes[:-1]).strip() == title:
                text_nodes[-1].text = page
                break

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def update_settings(settings_xml: bytes) -> bytes:
    root = ET.fromstring(settings_xml)
    update_fields = root.find("w:updateFields", NS)
    if update_fields is None:
        update_fields = ET.Element(qn("updateFields"))
        root.insert(0, update_fields)
    update_fields.set(qn("val"), "true")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def main() -> None:
    if not BACKUP.exists():
        shutil.copy2(REPORT, BACKUP)

    with zipfile.ZipFile(BACKUP, "r") as source:
        document_xml = update_document(source.read("word/document.xml"))
        settings_xml = update_settings(source.read("word/settings.xml"))
        fd, temporary_name = tempfile.mkstemp(suffix=".docx", dir=REPORT.parent)
        os.close(fd)
        try:
            with zipfile.ZipFile(temporary_name, "w", zipfile.ZIP_DEFLATED) as target:
                for item in source.infolist():
                    data = source.read(item.filename)
                    if item.filename == "word/document.xml":
                        data = document_xml
                    elif item.filename == "word/settings.xml":
                        data = settings_xml
                    target.writestr(item, data)
            os.replace(temporary_name, REPORT)
            shutil.copymode(BACKUP, REPORT)
        finally:
            if os.path.exists(temporary_name):
                os.unlink(temporary_name)

    print(f"Relatório atualizado: {REPORT.name}")
    print(f"Backup preservado: {BACKUP.name}")


if __name__ == "__main__":
    main()
